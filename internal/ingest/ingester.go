package ingest

import (
	"fmt"
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
	ext := filepath.Ext(baseName)
	nameWithoutExt := strings.TrimSuffix(baseName, ext)

	rawPath := filepath.Join(w.cfg.Server.TempDir, "raw_"+baseName)
	cleanPath := filepath.Join(w.cfg.Server.TempDir, "clean_"+nameWithoutExt+".mp3")

	defer os.Remove(rawPath)
	defer os.Remove(cleanPath)

	// 1. Download
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
	if err != nil {
		return err
	}

	// 2. Extract Metadata
	meta, err := metadata.GetLocal(rawPath)
	if err != nil {
		log.Printf("Warning: Could not read metadata for %s: %v", key, err)
	}

	// 3. Enrichment
	if meta.Artist == "" || meta.Title == "" {
		log.Printf("   🔍 Missing tags. Querying iTunes for: %s", baseName)
		enriched, err := metadata.EnrichViaITunes(baseName)
		if err != nil {
			log.Printf("   ⚠️ iTunes lookup failed: %v", err)
		} else {
			if enriched.Artist != "" {
				meta.Artist = enriched.Artist
			}
			if enriched.Title != "" {
				meta.Title = enriched.Title
			}
			if enriched.Album != "" {
				meta.Album = enriched.Album
			}
			if enriched.Genre != "" {
				meta.Genre = enriched.Genre
			}
			if enriched.Year != "" {
				meta.Year = enriched.Year
			}
			log.Printf("   ✨ Enriched: %s - %s (%s)", meta.Artist, meta.Title, meta.Year)
		}
	}

	if (meta.Publisher == "" || meta.Publisher == "Independent") && w.cfg.Services.DiscogsToken != "" {
		log.Printf("   💿 Missing Label. Querying Discogs for: %s - %s", meta.Artist, meta.Title)

		// Use Artist-Title for better search precision if we have them
		searchTerm := baseName
		if meta.Artist != "" && meta.Title != "" {
			searchTerm = fmt.Sprintf("%s - %s", meta.Artist, meta.Title)
		}

		discogsMeta, err := metadata.EnrichViaDiscogs(searchTerm, w.cfg.Services.DiscogsToken)
		if err == nil {
			if discogsMeta.Publisher != "" {
				meta.Publisher = discogsMeta.Publisher
				log.Printf("   🏷️  Discogs Found Label: %s", meta.Publisher)
			}
			// Discogs is also excellent for Electronic sub-genres (Styles), overwrite if present
			if discogsMeta.Genre != "" {
				meta.Genre = discogsMeta.Genre
			}
			if discogsMeta.Year != "" && meta.Year == "" {
				meta.Year = discogsMeta.Year
			}
		} else {
			log.Printf("   ⚠️ Discogs lookup failed: %v", err)
		}
	}

	// 4. Build Path
	destinationKey := organizer.BuildPath(meta, key)

	// 5. Normalize
	log.Printf("   -> Normalizing audio...")
	if err := audio.Normalize(rawPath, cleanPath); err != nil {
		return err
	}

	// 6. Upload
	log.Printf("   -> Uploading to: %s", destinationKey)
	fClean, err := os.Open(cleanPath)
	if err != nil {
		return err
	}
	defer fClean.Close()

	if err := w.storage.UploadAssetFile(destinationKey, fClean, "audio/mpeg", "public, max-age=31536000"); err != nil {
		return err
	}

	// 7. --- PERSIST TO DATABASE (NEW) ---
	// We map the metadata to our GORM model and save it.
	track := models.Track{
		Key:       destinationKey,
		Title:     meta.Title,
		Artist:    meta.Artist,
		Album:     meta.Album,
		Genre:     meta.Genre,
		Year:      meta.Year,
		Publisher: meta.Publisher,
		Format:    "mp3",
	}

	// Use FirstOrCreate to update existing entries or create new ones based on the 'Key'
	if result := w.db.DB.Where(models.Track{Key: destinationKey}).Assign(track).FirstOrCreate(&track); result.Error != nil {
		log.Printf("❌ Failed to save track to DB: %v", result.Error)
		// We don't return error here to allow the process to finish cleaning up B2
	} else {
		log.Printf("💾 Track saved to Database: %s (ID: %d)", track.Title, track.ID)
	}

	// 8. Delete Original
	return w.storage.DeleteIngestFile(key)
}
