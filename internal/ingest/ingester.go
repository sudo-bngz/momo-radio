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
	fRaw.Close() // Close before validation so ffprobe can read it

	// 2. NEW: Validation before processing
	log.Printf("   🔍 Validating integrity: %s", baseName)
	if err := audio.Validate(rawPath); err != nil {
		log.Printf("   ❌ Skipping corrupted file: %s", baseName)
		return w.storage.DeleteIngestFile(key) // Remove from queue so it doesn't loop
	}

	// 3. Extract Metadata (Initial local check)
	meta, err := metadata.GetLocal(rawPath)
	if err != nil {
		log.Printf("Warning: Local tags unreadable for %s", key)
	}

	// 4. Enrichment: DISCOGS FIRST
	if w.cfg.Services.DiscogsToken != "" {
		log.Printf("   💿 Querying Discogs (Primary): %s", baseName)
		discogsMeta, err := metadata.EnrichViaDiscogs(baseName, w.cfg.Services.DiscogsToken)
		if err == nil && (discogsMeta.Artist != "" || discogsMeta.Title != "") {
			meta = discogsMeta // Prefer Discogs for all fields
			log.Printf("   ✨ Discogs Found: %s - %s", meta.Artist, meta.Title)
		} else {
			log.Printf("   ⚠️ Discogs failed/no results for: %s", baseName)
		}
	}

	// 5. Enrichment: ITUNES FALLBACK
	if meta.Artist == "" || meta.Title == "" {
		log.Printf("   🔍 Fallback: Querying iTunes for: %s", baseName)
		itunesMeta, err := metadata.EnrichViaITunes(baseName)
		if err == nil && (itunesMeta.Artist != "" || itunesMeta.Title != "") {
			// Fill missing fields with iTunes data
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

	// 6. Final check: Use filename if still empty
	if meta.Artist == "" {
		meta.Artist = "Unknown Artist"
	}
	if meta.Title == "" {
		meta.Title = nameWithoutExt
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
