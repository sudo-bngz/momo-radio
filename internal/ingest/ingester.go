package ingest

import (
	"io"
	"log"
	"os"
	"path/filepath"
	"sort"
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

	log.Printf("Watcher started on '%s' [Provider: %s]...",
		w.cfg.Storage.BucketIngest,
		w.cfg.Storage.Provider,
	)

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
		if strings.HasSuffix(key, "/") {
			continue
		}

		if !audio.IsSupportedFormat(key) {
			log.Printf("🗑️ Removing junk file: %s", key)
			_ = w.storage.DeleteIngestFile(key)
			continue
		}

		log.Printf("Processing: %s", key)
		if err := w.processFile(key); err != nil {
			log.Printf("FAILED %s: %v", key, err)
			jobs.WithLabelValues("failure").Inc()
		} else {
			log.Printf("ORGANIZED %s", key)
			jobs.WithLabelValues("success").Inc()
		}
	}

	w.cleanupFolders(keys)
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

	// 2. Get Local Metadata
	meta, _ := metadata.GetLocal(rawPath)

	// 3. DEEP ACOUSTIC ANALYSIS
	log.Printf("   🎼 Performing Deep Acoustic Analysis...")
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
	}

	searchArtist := meta.Artist
	searchTitle := meta.Title
	var artistOrigin string

	if searchArtist == "" || searchTitle == "" {
		cleanA, cleanT := utils.SanitizeFilename(baseName)
		if searchArtist == "" {
			searchArtist = cleanA
		}
		if searchTitle == "" {
			searchTitle = cleanT
		}
	}

	// 4. Querying Discogs / iTunes
	if w.cfg.Services.DiscogsToken != "" {
		enriched, err := metadata.EnrichViaDiscogs(searchArtist, searchTitle, w.cfg.Services.DiscogsToken, w.cfg.Services.ContactEmail)
		if err == nil {
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

			time.Sleep(2 * time.Second)
			mbCountry, errAc := metadata.GetArtistCountryViaMusicBrainz(meta.Artist, w.cfg.Services.ContactEmail)
			if errAc == nil && mbCountry != "" {
				artistOrigin = utils.ResolveCountry(mbCountry)
			}
		}
	} else {
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
		}
	}

	meta.Year = utils.SanitizeYear(meta.Year)
	if meta.Artist == "" {
		meta.Artist = "Unknown Artist"
	}
	if meta.Title == "" {
		meta.Title = nameWithoutExt
	}
	if artistOrigin == "" {
		artistOrigin = "Unknown"
	}

	// 5. Normalize & Upload
	if err := audio.Normalize(rawPath, cleanPath); err != nil {
		return err
	}

	destinationKey := BuildPath(meta, key)
	fClean, err := os.Open(cleanPath)
	if err != nil {
		return err
	}
	defer fClean.Close()

	if err := w.storage.UploadAssetFile(destinationKey, fClean, "audio/mpeg", "public, max-age=31536000"); err != nil {
		return err
	}

	// A. Handle Artist
	var artist models.Artist
	w.db.DB.Where(models.Artist{Name: meta.Artist}).FirstOrCreate(&artist)
	if artist.ArtistCountry == "" && artistOrigin != "Unknown" {
		w.db.DB.Model(&artist).Update("ArtistCountry", artistOrigin)
	}

	// B. Handle Album
	var albumID *uint
	if meta.Album != "" {
		var album models.Album
		w.db.DB.Where(models.Album{
			Title:    meta.Album,
			ArtistID: artist.ID,
		}).Assign(models.Album{
			Year:           meta.Year,
			Publisher:      meta.Publisher,
			CatalogNumber:  meta.CatalogNumber,
			ReleaseCountry: utils.ResolveCountry(meta.Country),
		}).FirstOrCreate(&album)
		albumID = &album.ID
	}

	// C. Handle Track
	track := models.Track{
		Key:          destinationKey,
		Title:        meta.Title,
		ArtistID:     artist.ID,
		AlbumID:      albumID,
		Genre:        meta.Genre,
		Style:        meta.Style,
		Format:       "mp3",
		BPM:          meta.BPM,
		Duration:     meta.Duration,
		MusicalKey:   meta.MusicalKey,
		Scale:        meta.Scale,
		Danceability: meta.Danceability,
		Loudness:     meta.Loudness,
		FileSize:     int(obj.ContentLength),
	}

	w.db.DB.Where(models.Track{Key: destinationKey}).Assign(track).FirstOrCreate(&track)

	return w.storage.DeleteIngestFile(key)
}

func (w *Worker) cleanupFolders(allKeys []string) {
	var dirs []string
	for _, k := range allKeys {
		if strings.HasSuffix(k, "/") {
			dirs = append(dirs, k)
		}
	}

	sort.Slice(dirs, func(i, j int) bool {
		return len(dirs[i]) > len(dirs[j])
	})

	for _, dir := range dirs {
		isEmpty, err := w.storage.IsPrefixEmpty(dir)
		if err == nil && isEmpty {
			log.Printf("🧹 Removing empty folder: %s", dir)
			_ = w.storage.DeleteIngestFile(dir)
		}
	}
}
