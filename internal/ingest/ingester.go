package ingest

import (
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/prometheus/client_golang/prometheus"

	"momo-radio/internal/audio"
	"momo-radio/internal/config"
	database "momo-radio/internal/db"
	"momo-radio/internal/metadata"
	"momo-radio/internal/models"
	"momo-radio/internal/storage"
	"momo-radio/internal/utils"
)

var (
	jobs = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "radio_ingest_jobs_total",
			Help: "Total ingest jobs",
		},
		[]string{"status"},
	)
	duration = prometheus.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "radio_ingest_duration_seconds",
			Help:    "Processing time",
			Buckets: prometheus.DefBuckets,
		},
	)
)

func RegisterMetrics() {
	prometheus.MustRegister(jobs, duration)
}

type Worker struct {
	cfg         *config.Config
	storage     *storage.Client
	db          *database.Client
	analysisSem chan struct{}
}

func New(cfg *config.Config, store *storage.Client, db *database.Client) *Worker {
	return &Worker{cfg: cfg, storage: store, db: db, analysisSem: make(chan struct{}, 2)}
}

func (w *Worker) Run() {
	ticker := time.NewTicker(time.Duration(w.cfg.Server.PollingInterval) * time.Second)
	defer ticker.Stop()

	log.Printf("Watcher started on '%s'...", w.cfg.B2.BucketIngest)
	w.processQueue()

	for range ticker.C {
		w.processQueue()
	}
}

func (w *Worker) processQueue() {
	keys, err := w.storage.ListIngestFiles()
	if err != nil {
		log.Printf("Error listing bucket: %v", err)
		return
	}

	if len(keys) > 0 {
		log.Printf("Found %d items in ingest queue.", len(keys))
	}

	for _, key := range keys {
		if strings.HasSuffix(key, "/") || !audio.IsSupportedFormat(key) {
			continue
		}

		log.Printf("Processing: %s", key)
		if err := w.processFile(key); err != nil {
			log.Printf("❌ FAILED %s: %v", key, err)
			jobs.WithLabelValues("failure").Inc()
		} else {
			log.Printf("✅ ORGANIZED %s", key)
			jobs.WithLabelValues("success").Inc()
		}
	}
}

func (w *Worker) processFile(key string) error {
	timer := prometheus.NewTimer(duration)
	defer timer.ObserveDuration()

	baseName := filepath.Base(key)
	ext := filepath.Ext(baseName)
	nameWithoutExt := strings.TrimSuffix(baseName, ext)

	rawPath := filepath.Join(w.cfg.Server.TempDir, "raw_"+baseName)
	cleanPath := filepath.Join(w.cfg.Server.TempDir, "clean_"+nameWithoutExt+".mp3")

	defer os.Remove(rawPath)
	defer os.Remove(cleanPath)

	// 1. Download & Validate
	obj, err := w.storage.DownloadIngestFile(key)
	if err != nil {
		return err
	}
	fRaw, _ := os.Create(rawPath)
	io.Copy(fRaw, obj.Body)
	obj.Body.Close()
	fRaw.Close()

	if err := audio.Validate(rawPath); err != nil {
		return w.storage.DeleteIngestFile(key)
	}

	// 2. Get Local Metadata (Internal Tags)
	meta, _ := metadata.GetLocal(rawPath)

	// 3. DEEP ACOUSTIC ANALYSIS (Essentia)
	log.Printf("   🎼 Performing Deep Acoustic Analysis on original %s...", ext)
	w.analysisSem <- struct{}{}
	analysis, err := audio.AnalyzeDeep(rawPath)
	<-w.analysisSem

	if err == nil {
		meta.BPM = analysis.BPM
		meta.MusicalKey = analysis.MusicalKey
		meta.Scale = analysis.Scale
		meta.Danceability = analysis.Danceability
		meta.Loudness = analysis.Loudness
		meta.Duration = analysis.Duration
		// Note: use the Discogs country if found, otherwise we could use analysis.Country
		log.Printf("   📊 Result: %.2f BPM | Key: %s %s", analysis.BPM, analysis.MusicalKey, analysis.Scale)
	}

	// Determine our "Best Knowledge" for searching
	searchArtist := meta.Artist
	searchTitle := meta.Title

	var ac string

	if searchArtist == "" || searchTitle == "" {
		log.Printf("   🔍 ID3 tags missing. Falling back to filename parsing...")
		cleanA, cleanT := utils.SanitizeFilename(baseName)
		if searchArtist == "" {
			searchArtist = cleanA
		}
		if searchTitle == "" {
			searchTitle = cleanT
		}
	}

	// 4. Querying Discogs (Enhanced Strategy)
	if w.cfg.Services.DiscogsToken != "" {
		log.Printf("   💿 Querying Discogs: [%s] - [%s]", searchArtist, searchTitle)

		// This now performs 2 calls: Search + Release Details
		enriched, err := metadata.EnrichViaDiscogs(searchArtist, searchTitle, w.cfg.Services.DiscogsToken, w.cfg.Services.ContactEmail)

		if err == nil {
			// Map ALL the new fields
			meta.Genre = enriched.Genre
			meta.Style = enriched.Style
			meta.Country = enriched.Country
			meta.CatalogNumber = enriched.CatalogNumber
			meta.Publisher = enriched.Publisher

			if meta.Year == "" {
				meta.Year = enriched.Year
			}
			if meta.Album == "" {
				meta.Album = enriched.Album
			}
			if meta.Artist == "" {
				meta.Artist = enriched.Artist
			}
			if meta.Title == "" {
				meta.Title = enriched.Title
			}

			log.Printf("   ✨ Enriched: %s [%s] (%s) - Cat: %s", meta.Genre, meta.Style, meta.Country, meta.CatalogNumber)

			// MANDATORY RATE LIMIT: Sleep 2s because we made 2 requests
			time.Sleep(2 * time.Second)

			log.Printf("   👤 Fetching Artist Origin for: %s", meta.Artist)
			ac, errAc := metadata.GetArtistCountryViaMusicBrainz(meta.Artist, w.cfg.Services.ContactEmail)
			if errAc == nil {
				log.Printf("   ✅ Artist Origin: %s", utils.ResolveCountry(ac))
			} else {
				log.Printf("   ⚠️ Artist Origin not found: %v", errAc)
			}
		} else {
			log.Printf("   ⚠️ Discogs failed: %v", err)
		}
	} else {
		// ITUNES FALLBACK
		itunesMeta, err := metadata.EnrichViaITunes(searchArtist + " " + searchTitle)
		if err == nil {
			if meta.Artist == "" {
				meta.Artist = itunesMeta.Artist
			}
			if meta.Title == "" {
				meta.Title = itunesMeta.Title
			}
			if meta.Album == "" {
				meta.Album = itunesMeta.Album
			}
			if meta.Genre == "" {
				meta.Genre = itunesMeta.Genre
			}
			if meta.Year == "" {
				meta.Year = itunesMeta.Year
			}
			log.Printf("   ✨ iTunes Found: %s - %s", meta.Artist, meta.Title)
		}
	}

	meta.Year = utils.SanitizeYear(meta.Year)

	// Fallback cleanup
	if meta.Artist == "" {
		meta.Artist = "Unknown Artist"
	}
	if meta.Title == "" {
		meta.Title = nameWithoutExt
	}
	if ac == "" {
		ac = meta.Country
	}

	// 5. Normalize & Upload
	log.Printf("   -> Normalizing audio...")
	if err := audio.Normalize(rawPath, cleanPath); err != nil {
		log.Printf("❌ Normalization failed: %v", err)
		return err
	}

	destinationKey := BuildPath(meta, key)
	log.Printf("   -> Uploading to: %s", destinationKey)
	fClean, err := os.Open(cleanPath)
	if err != nil {
		return err
	}
	defer fClean.Close()

	if err := w.storage.UploadAssetFile(destinationKey, fClean, "audio/mpeg", "public, max-age=31536000"); err != nil {
		return err
	}

	// 6. DB Persistence
	track := models.Track{
		Key:            destinationKey,
		Title:          meta.Title,
		Artist:         meta.Artist,
		Album:          meta.Album,
		Genre:          meta.Genre, // Broad: "Electronic"
		Style:          meta.Style, // Specific: "Deep House, Minimal"
		Year:           meta.Year,
		Publisher:      meta.Publisher,
		CatalogNumber:  meta.CatalogNumber,
		ReleaseCountry: meta.Country,
		ArtistCountry:  ac,
		Format:         "mp3",
		BPM:            meta.BPM,
		Duration:       meta.Duration,
		MusicalKey:     meta.MusicalKey,
		Scale:          meta.Scale,
		Danceability:   meta.Danceability,
		Loudness:       meta.Loudness,
	}
	// Use FirstOrCreate to avoid duplicates, or Upsert logic
	w.db.DB.Where(models.Track{Key: destinationKey}).Assign(track).FirstOrCreate(&track)

	return w.storage.DeleteIngestFile(key)
}
