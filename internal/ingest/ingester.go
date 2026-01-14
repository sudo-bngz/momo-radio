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
	"momo-radio/internal/organizer"
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

// Update constructor to accept DB
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

	// 4. DEEP ACOUSTIC ANALYSIS (Essentia)
	// Run this BEFORE normalization/transcoding to get the best math results.
	log.Printf("   🎼 Performing Deep Acoustic Analysis on original %s...", ext)

	// Acquire semaphore to limit CPU usage (max 2 concurrent analyses)
	w.analysisSem <- struct{}{}
	analysis, err := audio.AnalyzeDeep(rawPath)
	<-w.analysisSem // Release

	if err == nil {
		meta.BPM = analysis.BPM
		meta.MusicalKey = analysis.MusicalKey
		meta.Scale = analysis.Scale
		meta.Danceability = analysis.Danceability
		meta.Loudness = analysis.Loudness
		meta.Duration = analysis.Duration
		log.Printf("   📊 Result: %.2f BPM | Key: %s %s", analysis.BPM, analysis.MusicalKey, analysis.Scale)
	}

	// Determine our "Best Knowledge" for searching
	searchArtist := meta.Artist
	searchTitle := meta.Title
	searchAlbum := meta.Album

	// 3. Fallback to Filename if tags are missing
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

	// 4. Querying Discogs for others metadata
	if w.cfg.Services.DiscogsToken != "" {
		log.Printf("   💿 Querying Discogs: [%s] - [%s] (Album: %s)", searchArtist, searchTitle, searchAlbum)
		// Pass searchAlbum to the API for better matching
		enriched, err := metadata.EnrichViaDiscogs(searchArtist, searchTitle, w.cfg.Services.DiscogsToken)

		if err == nil {
			meta.Genre = enriched.Genre
			meta.Publisher = enriched.Publisher
			if meta.Year == "" {
				meta.Year = enriched.Year
			}
			if meta.Album == "" {
				meta.Album = enriched.Album
			} // Only fill if we didn't have it

			// Only update Artist/Title if they were blank
			if meta.Artist == "" {
				meta.Artist = enriched.Artist
			}
			if meta.Title == "" {
				meta.Title = enriched.Title
			}

			log.Printf("   ✨ Enriched: %s - %s [%s]", meta.Artist, meta.Title, meta.Genre)
		}
	} else {
		log.Printf("   ⚠️ Discogs failed: %v", err)

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

	// 4. STEP 4: Fallback cleanup
	if meta.Artist == "" {
		meta.Artist = "Unknown Artist"
	}
	if meta.Title == "" {
		meta.Title = nameWithoutExt
	}
	// 5. Normalize & Upload (Safe now because validated earlier)
	log.Printf("   -> Normalizing audio...")
	if err := audio.Normalize(rawPath, cleanPath); err != nil {
		log.Printf("❌ Normalization failed: %v", err)
		return err
	}

	destinationKey := organizer.BuildPath(meta, key)
	log.Printf("   -> Uploading to: %s", destinationKey)
	fClean, err := os.Open(cleanPath)
	if err != nil {
		return err
	}
	defer fClean.Close()

	if err := w.storage.UploadAssetFile(destinationKey, fClean, "audio/mpeg", "public, max-age=31536000"); err != nil {
		return err
	}

	// 8. DB Persistence
	track := models.Track{
		Key:          destinationKey,
		Title:        meta.Title,
		Artist:       meta.Artist,
		Album:        meta.Album,
		Genre:        meta.Genre,
		Year:         meta.Year,
		Publisher:    meta.Publisher,
		Format:       "mp3",
		BPM:          meta.BPM,
		Duration:     meta.Duration,
		MusicalKey:   meta.MusicalKey,
		Scale:        meta.Scale,
		Danceability: meta.Danceability,
		Loudness:     meta.Loudness,
	}
	w.db.DB.Where(models.Track{Key: destinationKey}).Assign(track).FirstOrCreate(&track)

	return w.storage.DeleteIngestFile(key)
}

// RepairMetadata loops through the DB and updates records using only existing DB data.
func (w *Worker) RepairMetadata() {
	log.Println("🛠️ Starting Metadata Repair process...")

	var tracks []models.Track
	// Fetch all tracks. You could also use .Where("genre NOT LIKE '%, %'")
	// to only target tracks without the new comma-separated style list.
	if err := w.db.DB.Find(&tracks).Error; err != nil {
		log.Printf("❌ Failed to fetch tracks: %v", err)
		return
	}

	log.Printf("🧐 Found %d tracks in database to analyze.", len(tracks))

	for _, track := range tracks {
		// Use the current DB fields for the query.
		// If Artist/Title are missing, we fall back to the filename (Key).
		searchArtist := track.Artist
		searchTitle := track.Title
		searchAlbum := track.Album

		if searchArtist == "" || searchTitle == "" {
			log.Printf("   🔍 DB fields missing for %s, parsing filename...", track.Key)
			searchArtist, searchTitle = utils.SanitizeFilename(filepath.Base(track.Key))
		}

		log.Printf("🔄 Repairing: [%s] - [%s] (Album: %s)", searchArtist, searchTitle, searchAlbum)

		// 1. Query Discogs using DB data (Aggressive style/genre extraction)
		// We pass the search terms to the improved EnrichViaDiscogs (artist, title, album, token)
		enriched, err := metadata.EnrichViaDiscogs(searchArtist, searchTitle, w.cfg.Services.DiscogsToken)
		if err != nil {
			log.Printf("   ⚠️ Discogs lookup failed for %s: %v", track.Key, err)
			// Still sleep to respect rate limits even on failure
			time.Sleep(1 * time.Second)
			continue
		}

		// 2. Update the record
		// We update the Genre, Publisher, Year, and Album.
		// We keep the Artist/Title from the DB if they were already good.
		err = w.db.DB.Model(&track).Updates(models.Track{
			Genre:     enriched.Genre,     // Get the new deep Styles (e.g. "Minimal, Techno")
			Publisher: enriched.Publisher, // Correct the Label
			Year:      enriched.Year,      // Ensure original release year
			Album:     enriched.Album,     // Fill in the EP/Album name if missing
		}).Error

		if err != nil {
			log.Printf("   ❌ Failed to update DB for ID %d: %v", track.ID, err)
		} else {
			log.Printf("   ✅ Repaired: %s - %s [%s]", track.Artist, track.Title, enriched.Genre)
		}

		// 3. Rate limiting: Discogs allows 60 req/min with a token.
		// 1 second is safe and faster than 2 seconds.
		time.Sleep(1 * time.Second)
	}

	log.Println("✨ Metadata Repair complete!")
}
