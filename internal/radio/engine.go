package radio

import (
	"context"
	"encoding/json"
	"io"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"

	"momo-radio/internal/config"
	database "momo-radio/internal/db"
	"momo-radio/internal/logger"
	"momo-radio/internal/models"
	"momo-radio/internal/scheduler"
	"momo-radio/internal/storage"
)

type Engine struct {
	cfg           *config.Config
	storage       *storage.Client
	db            *database.Client
	rdb           *redis.Client
	runID         int64
	cache         *CacheManager
	state         *StateManager
	scheduler     *scheduler.Manager
	activeStreams sync.Map // Key: uuid.UUID, Value: context.CancelFunc
}

type s3Adapter struct {
	store *storage.Client
}

func (a *s3Adapter) DownloadFile(key string) (io.ReadCloser, error) {
	obj, err := a.store.DownloadFile(key)
	if err != nil {
		return nil, err
	}
	return obj.Body, nil
}

func New(cfg *config.Config, store *storage.Client, db *database.Client, rdb *redis.Client) *Engine {
	adapter := &s3Adapter{store: store}

	return &Engine{
		cfg:       cfg,
		storage:   store,
		db:        db,
		rdb:       rdb,
		runID:     time.Now().Unix(),
		cache:     NewCacheManager(adapter, cfg.Server.TempDir),
		state:     NewStateManager(db.DB),
		scheduler: scheduler.NewManager(db.DB, cfg.Server.Timezone),
	}
}

func (e *Engine) StartSupervisor(ctx context.Context) {
	if e.cfg.Radio.DryRun {
		logger.Log.Info("Engine running in Dry Run mode. Supervisor will not bind.")
		return
	}

	logger.Log.Info("Starting Radio Engine Supervisor", zap.Int64("runID", e.runID))
	go e.startRedirectServer()

	logger.Log.Info("Bootstrapping active tenants from database state...")
	e.bootstrapActiveStreams(ctx)

	pubsub := e.rdb.Subscribe(ctx, "radio.control")
	defer pubsub.Close()

	ch := pubsub.Channel()
	logger.Log.Info("🎧 Radio Supervisor is listening for commands", zap.String("channel", "radio.control"))

	for msg := range ch {
		var payload struct {
			OrgID  string `json:"org_id"`
			Action string `json:"action"`
		}

		if err := json.Unmarshal([]byte(msg.Payload), &payload); err != nil {
			logger.Log.Error("Invalid control payload dropped", zap.Error(err), zap.String("payload", msg.Payload))
			continue
		}

		orgUUID, err := uuid.Parse(payload.OrgID)
		if err != nil {
			logger.Log.Error("Invalid UUID parsed from payload", zap.Error(err), zap.String("org_id", payload.OrgID))
			continue
		}

		switch payload.Action {
		case "start":
			e.handleStart(ctx, orgUUID)
		case "stop":
			e.handleStop(orgUUID)
		}
	}
}

func (e *Engine) bootstrapActiveStreams(ctx context.Context) {
	var defaultMounts []models.MountPoint
	err := e.db.DB.Where("is_default = ?", true).Find(&defaultMounts).Error
	if err != nil {
		logger.Log.Error("Failed to query default mount points during bootstrap", zap.Error(err))
		return
	}

	logger.Log.Info("Found tenant streams to restore", zap.Int("count", len(defaultMounts)))
	for _, mount := range defaultMounts {
		logger.Log.Info("Auto-restoring pipeline for tenant", zap.String("org_id", mount.OrganizationID.String()))
		e.handleStart(ctx, mount.OrganizationID)
	}
}

func (e *Engine) handleStart(parentCtx context.Context, orgID uuid.UUID) {
	if _, running := e.activeStreams.Load(orgID); running {
		logger.Log.Warn("Pipeline instance already running. Skipping invocation.", zap.String("org_id", orgID.String()))
		return
	}

	logger.Log.Info("Launching live transmission infrastructure", zap.String("org_id", orgID.String()))
	streamCtx, cancelFunc := context.WithCancel(parentCtx)
	e.activeStreams.Store(orgID, cancelFunc)

	go func() {
		defer e.activeStreams.Delete(orgID)
		e.runTenantPipeline(streamCtx, orgID)
	}()
}

func (e *Engine) handleStop(orgID uuid.UUID) {
	cancelInterface, running := e.activeStreams.Load(orgID)
	if !running {
		logger.Log.Warn("Stop command received but no active context found.", zap.String("org_id", orgID.String()))
		return
	}

	logger.Log.Info("Dismantling live execution pipeline", zap.String("org_id", orgID.String()))
	cancelFunc := cancelInterface.(context.CancelFunc)
	cancelFunc()
	e.activeStreams.Delete(orgID)
}

func (e *Engine) runTenantPipeline(ctx context.Context, orgID uuid.UUID) {
	var defaultMount models.MountPoint
	err := e.db.DB.Where("organization_id = ? AND is_default = ?", orgID, true).First(&defaultMount).Error
	if err != nil {
		logger.Log.Error("Aborting: No active default mount point found.", zap.String("org_id", orgID.String()), zap.Error(err))
		return
	}

	state, err := e.state.GetCurrentState(orgID)
	var resumeTrackID uint
	if err == nil && time.Since(state.UpdatedAt) < 10*time.Minute {
		logger.Log.Info("RECOVERED STATE: Resuming track", zap.String("org_id", orgID.String()), zap.Uint("track_id", state.TrackID))
		resumeTrackID = state.TrackID
	}

	for {
		select {
		case <-ctx.Done():
			logger.Log.Info("Tenant pipeline stopped cleanly.", zap.String("org_id", orgID.String()))
			return
		default:
		}

		pipeCtx, pipeCancel := context.WithCancel(ctx)
		pr, pw := io.Pipe()

		go func() {
			<-pipeCtx.Done()
			_ = pr.Close()
			_ = pw.Close()
		}()

		go e.runOrchestrator(pipeCtx, orgID, pw, resumeTrackID)
		e.streamToMediaMTX(pipeCtx, orgID, defaultMount, pr)
		pipeCancel()

		if ctx.Err() != nil {
			return
		}

		logger.Log.Warn("RTMP stream ended unexpectedly. Restarting in 2s...", zap.String("org_id", orgID.String()))
		streamRestarts.WithLabelValues(orgID.String()).Inc()
		time.Sleep(2 * time.Second)
	}
}
