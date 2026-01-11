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
	cfg     *config.Config
	storage *storage.Client
	db      *database.Client
}

// Update constructor to accept DB
func New(cfg *config.Config, store *storage.Client, db *database.Client) *Worker {
	return &Worker{cfg: cfg, storage: store, db: db}
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

	// 1. PRE-FLIGHT FILENAME PARSING
	cleanArtist, cleanTitle := utils.SanitizeFilename(baseName)

	searchQuery := metadata.CleanQuery(baseName)
	log.Printf("   🔍 Parsing: '%s'", baseName)
	log.Printf("   🔍 Pre-flight query: '%s' | Parsed Artist: '%s' | Parsed Title: '%s'", searchQuery, cleanArtist, cleanTitle)

	ext := filepath.Ext(baseName)
	nameWithoutExt := strings.TrimSuffix(baseName, ext)
	rawPath := filepath.Join(w.cfg.Server.TempDir, "raw_"+baseName)
	cleanPath := filepath.Join(w.cfg.Server.TempDir, "clean_"+nameWithoutExt+".mp3")

	defer os.Remove(rawPath)
	defer os.Remove(cleanPath)

	// 2. Download & Validate
	obj, err := w.storage.DownloadIngestFile(key)
	if err != nil {
		return err
	}
	fRaw, err := os.Create(rawPath)
	if err != nil {
		obj.Body.Close()
		return err
	}
	_, err = io.Copy(fRaw, obj.Body)
	obj.Body.Close()
	fRaw.Close()

	if err := audio.Validate(rawPath); err != nil {
		log.Printf("   ❌ Skipping corrupted file: %s", baseName)
		return w.storage.DeleteIngestFile(key)
	}

	meta, _ := metadata.GetLocal(rawPath)

	// DISCOGS PRIMARY
	if w.cfg.Services.DiscogsToken != "" {
		log.Printf("   💿 Querying Discogs: %s", searchQuery)
		discogsMeta, err := metadata.EnrichViaDiscogs(searchQuery, w.cfg.Services.DiscogsToken)

		if err == nil {
			// MERGE STRATEGY:
			// We trust Discogs for secondary info (Label, Year, Genre).
			meta.Publisher = discogsMeta.Publisher
			meta.Genre = discogsMeta.Genre
			meta.Year = discogsMeta.Year
			meta.Album = discogsMeta.Album

			// FIX: Prevent Album name (e.g., "Unknown 3") from becoming the Title.
			// If we have a good parsed title from the filename, we use it.
			if cleanTitle != "" {
				meta.Title = cleanTitle
				// If the API returned a different title, it's likely the Album name.
				if discogsMeta.Title != cleanTitle && meta.Album == "" {
					meta.Album = discogsMeta.Title
				}
			} else {
				meta.Title = discogsMeta.Title
			}

			if meta.Artist == "" {
				meta.Artist = discogsMeta.Artist
			}

			log.Printf("   ✨ Discogs Found: %s - %s (Album: %s)", meta.Artist, meta.Title, meta.Album)
		} else {
			log.Printf("   ⚠️ Discogs failed: %v", err)

			// ITUNES FALLBACK
			itunesMeta, err := metadata.EnrichViaITunes(searchQuery)
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
	}

	// 4. FINAL CLEANUP
	// Use sanitized filename parts if APIs still left fields blank
	if meta.Artist == "" {
		if cleanArtist != "" {
			meta.Artist = cleanArtist
		} else {
			meta.Artist = "Unknown Artist"
		}
	}
	if meta.Title == "" {
		if cleanTitle != "" {
			meta.Title = cleanTitle
		} else {
			meta.Title = nameWithoutExt
		}
	}
	// 7. Normalize & Upload (Safe now because we validated earlier)
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
		Key: destinationKey, Title: meta.Title, Artist: meta.Artist,
		Album: meta.Album, Genre: meta.Genre, Year: meta.Year,
		Publisher: meta.Publisher, Format: "mp3",
	}
	w.db.DB.Where(models.Track{Key: destinationKey}).Assign(track).FirstOrCreate(&track)

	return w.storage.DeleteIngestFile(key)
}

// RepairMetadata loops through the DB and updates records using the latest Discogs logic.
func (w *Worker) RepairMetadata() {
	log.Println("🛠️ Starting Metadata Repair process...")

	var tracks []models.Track
	// Find tracks that need fixing (e.g., missing a comma in Genre, or specific bad titles)
	// You can adjust the WHERE clause to target specific tracks.
	if err := w.db.DB.Find(&tracks).Error; err != nil {
		log.Printf("❌ Failed to fetch tracks: %v", err)
		return
	}

	log.Printf("🧐 Found %d tracks to analyze.", len(tracks))

	for _, track := range tracks {
		// Use the 'Key' (the path in storage) as the source of truth for the filename
		baseName := filepath.Base(track.Key)

		// 1. Re-parse the filename using your new sanitizer
		_, cleanTitle := utils.SanitizeFilename(baseName)
		searchQuery := metadata.CleanQuery(baseName)

		log.Printf("🔄 Processing: %s -> Query: %s", track.Key, searchQuery)

		// 2. Query Discogs using the new logic (comma-separated styles)
		newMeta, err := metadata.EnrichViaDiscogs(baseName, w.cfg.Services.DiscogsToken)
		if err != nil {
			log.Printf("   ⚠️ Skipping %s: %v", baseName, err)
			continue
		}

		// 3. Apply the "Unknown 3" fix logic
		finalTitle := cleanTitle
		if cleanTitle == "" || cleanTitle == baseName {
			finalTitle = newMeta.Title
		}

		// 4. Update the database record
		err = w.db.DB.Model(&track).Updates(models.Track{
			Artist:    newMeta.Artist,
			Title:     finalTitle,
			Album:     newMeta.Album,
			Genre:     newMeta.Genre, // This now contains the full style list
			Publisher: newMeta.Publisher,
			Year:      newMeta.Year,
		}).Error

		if err != nil {
			log.Printf("   ❌ Failed to update DB for %s: %v", track.Key, err)
		} else {
			log.Printf("   ✅ Updated: %s - %s [%s]", track.Artist, track.Title, track.Genre)
		}

		// 5. Be kind to the Discogs API (Rate limiting)
		time.Sleep(2 * time.Second)
	}

	log.Println("✨ Metadata Repair complete!")
}
