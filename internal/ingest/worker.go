package ingest

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"path/filepath"
	"sort"

	"github.com/hibiken/asynq"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/redis/go-redis/v9"

	"momo-radio/internal/config"
	database "momo-radio/internal/db"
	"momo-radio/internal/models"
	"momo-radio/internal/storage"
)

// ============================================================================
// METRICS & CONSTANTS
// ============================================================================

const TypeTrackProcess = "track:process"
const TypeArtistEnrich = "artist:enrich"

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

// ============================================================================
// PAYLOAD DEFINITIONS
// ============================================================================

type TrackProcessPayload struct {
	TrackID uint   `json:"track_id"`
	FileKey string `json:"file_key"`
	IsRetry bool   `json:"is_retry"`
}

func (p TrackProcessPayload) TrackIDStr() string {
	return fmt.Sprintf("%d", p.TrackID)
}

type ArtistEnrichPayload struct {
	ArtistID uint `json:"artist_id"`
}

// ============================================================================
//  WORKER ENGINE
// ============================================================================

type Worker struct {
	cfg         *config.Config
	storage     *storage.Client
	db          *database.Client
	redis       *redis.Client
	analysisSem chan struct{}
	asynqClient *asynq.Client // ⚡️ ADDED: Gives the worker the ability to enqueue new jobs
}

func New(cfg *config.Config, store *storage.Client, db *database.Client, redisClient *redis.Client, asynqClient *asynq.Client) *Worker {
	return &Worker{
		cfg:         cfg,
		storage:     store,
		db:          db,
		redis:       redisClient,
		analysisSem: make(chan struct{}, 2),
		asynqClient: asynqClient,
	}
}

// ============================================================================
// THE ORCHESTRATOR
// ============================================================================

func (w *Worker) HandleProcessTask(ctx context.Context, t *asynq.Task) error {
	timer := prometheus.NewTimer(duration)
	defer timer.ObserveDuration()

	var payload TrackProcessPayload
	if err := json.Unmarshal(t.Payload(), &payload); err != nil {
		log.Printf("Task Failed: Failed to parse payload: %v", err)
		return fmt.Errorf("failed to parse payload: %v", err)
	}

	log.Printf("Starting Job for Track ID %d: %s", payload.TrackID, payload.FileKey)

	pCtx := &ProcessingContext{
		Worker:  w,
		Ctx:     ctx,
		Payload: payload,
	}

	steps := []Step{
		&SetupStep{},
		&DownloadStep{},
		&VaultStep{},
		&AnalysisStep{},
		&NormalizeStep{},
		&UploadStep{},
		&DatabaseSaveStep{},
		&EnrichStep{},
	}

	for _, step := range steps {
		progress := (indexOf(steps, step) * 100) / len(steps)
		w.updateStatus(ctx, payload.TrackIDStr(), step.Name(), progress)

		if err := step.Execute(pCtx); err != nil {
			w.failTask(ctx, payload, err)
			return err
		}
	}

	if !payload.IsRetry {
		w.storage.DeleteIngestFile(payload.FileKey)
		w.cleanupFolders([]string{payload.FileKey})
	}

	w.updateStatus(ctx, payload.TrackIDStr(), "completed", 100)
	jobs.WithLabelValues("success").Inc()
	log.Printf("Job Completed: Track ID %d", payload.TrackID)

	return nil
}

// ============================================================================
// SHARED UTILITIES
// ============================================================================

func (w *Worker) updateStatus(ctx context.Context, trackIDStr, status string, progress int) {
	w.db.DB.Model(&models.Track{}).Where("id = ?", trackIDStr).Updates(map[string]any{
		"processing_status":   status,
		"processing_progress": progress,
	})
	w.redis.Publish(ctx, "track_status:"+trackIDStr, status)
}

func (w *Worker) failTask(ctx context.Context, payload TrackProcessPayload, err error) {
	w.updateStatus(ctx, payload.TrackIDStr(), "failed", 0)
	jobs.WithLabelValues("failure").Inc()
	log.Printf("Task Failed (Track %d): %v", payload.TrackID, err)
}

func (w *Worker) cleanupFolders(allKeys []string) {
	var dirs []string
	for _, k := range allKeys {
		dir := filepath.Dir(k)
		if dir != "." && dir != "/" {
			dirs = append(dirs, dir+"/")
		}
	}

	sort.Slice(dirs, func(i, j int) bool {
		return len(dirs[i]) > len(dirs[j])
	})

	for _, dir := range dirs {
		if isEmpty, err := w.storage.IsPrefixEmpty(dir); err == nil && isEmpty {
			_ = w.storage.DeleteIngestFile(dir)
		}
	}
}

func indexOf(steps []Step, step Step) int {
	for i, s := range steps {
		if s.Name() == step.Name() {
			return i + 1
		}
	}
	return 0
}
