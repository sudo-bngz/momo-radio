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
	"momo-radio/internal/metadata"
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
}

func New(cfg *config.Config, store *storage.Client) *Worker {
	return &Worker{cfg: cfg, storage: store}
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
		// Skip folders or unsupported audio formats
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

	// Local Temp Paths
	rawPath := filepath.Join(w.cfg.Server.TempDir, "raw_"+baseName)
	// normalizeAudio always outputs mp3
	cleanPath := filepath.Join(w.cfg.Server.TempDir, "clean_"+nameWithoutExt+".mp3")

	defer os.Remove(rawPath)
	defer os.Remove(cleanPath)

	// 1. Download
	obj, err := w.storage.DownloadIngestFile(key)
	if err != nil {
		return err
	}
	// Stream to file
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

	// 3. Enrichment (iTunes)
	if meta.Artist == "" || meta.Title == "" {
		log.Printf("   🔍 Missing tags. Querying iTunes for: %s", baseName)
		enriched, err := metadata.EnrichViaITunes(baseName)
		if err != nil {
			log.Printf("   ⚠️ iTunes lookup failed: %v", err)
		} else {
			// Merge enriched data
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

	// 4. Build Path
	destinationKey := organizer.BuildPath(meta, key)

	// 5. Normalize
	log.Printf("   -> Normalizing audio and stripping headers...")
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

	if err := w.storage.UploadStreamFile(destinationKey, fClean, "audio/mpeg", "public, max-age=31536000"); err != nil {
		return err
	}

	// 7. Delete Original
	return w.storage.DeleteIngestFile(key)
}
