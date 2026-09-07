package worker

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/hibiken/asynq"
	"go.uber.org/zap"
	"gorm.io/gorm"

	"momo-radio/internal/logger"
	"momo-radio/internal/models"
	"momo-radio/internal/storage"
	"momo-radio/internal/utils"
)

const TypeTrackDelete = "track:delete"

type TrackDeletionPayload struct {
	TrackID        uint      `json:"track_id"`
	OrganizationID uuid.UUID `json:"organization_id"`
	Key            string    `json:"key"`
	MasterKey      string    `json:"master_key"`
	WaveformKey    string    `json:"waveform_key"`
}

type TrackWorker struct {
	db      *gorm.DB
	storage *storage.Client
	cdn     *utils.CDNBuilder
}

func NewTrackWorker(db *gorm.DB, st *storage.Client, cdn *utils.CDNBuilder) *TrackWorker {
	return &TrackWorker{
		db:      db,
		storage: st,
		cdn:     cdn,
	}
}

func (w *TrackWorker) HandleDeleteTrackTask(ctx context.Context, t *asynq.Task) error {
	var payload TrackDeletionPayload
	if err := json.Unmarshal(t.Payload(), &payload); err != nil {
		return fmt.Errorf("failed to unmarshal track deletion payload: %w", err)
	}

	logger.Log.Info("Processing track deletion", zap.Uint("track_id", payload.TrackID))

	// 1. Delete HLS / Audio assets (from bucketAssets)
	if payload.Key != "" {
		if err := w.storage.DeleteAssetFile(payload.Key); err != nil {
			logger.Log.Warn("Failed to delete audio file from assets bucket", zap.Error(err), zap.String("key", payload.Key))
		}
	}

	// 2. Delete Master Source File (from bucketMaster)
	if payload.MasterKey != "" {
		if err := w.storage.DeleteMasterFile(payload.MasterKey); err != nil {
			logger.Log.Warn("Failed to delete master audio file from master bucket", zap.Error(err), zap.String("key", payload.MasterKey))
		}
	}

	// 3. Delete Waveform JSON / Data (from bucketAssets)
	if payload.WaveformKey != "" {
		if err := w.storage.DeleteAssetFile(payload.WaveformKey); err != nil {
			logger.Log.Warn("Failed to delete waveform file from assets bucket", zap.Error(err), zap.String("key", payload.WaveformKey))
		}
	}

	// 4. Purge CDN cache
	if w.cdn != nil && payload.Key != "" {
		fullURL := fmt.Sprintf("%s/%s", "https://cdn.yourdomain.com", payload.Key) // Update if needed
		go func() {
			if err := w.cdn.PurgeCache(fullURL); err != nil {
				logger.Log.Warn("Failed to purge CDN cache for deleted track", zap.Error(err), zap.String("url", fullURL))
			}
		}()
	}

	// 5. DATABASE CLEANUP

	// Step 5a: Fetch the track first so GORM knows what we are working with
	var track models.Track
	if err := w.db.Unscoped().Where("id = ? AND organization_id = ?", payload.TrackID, payload.OrganizationID).First(&track).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			logger.Log.Info("Track already removed from DB, skipping", zap.Uint("track_id", payload.TrackID))
			return nil
		}
		return err
	}

	// Step 5b: Clear Many-to-Many Artist links
	// (This safely removes rows in `track_artists` without deleting the actual Artist records)
	if err := w.db.Model(&track).Association("Artists").Clear(); err != nil {
		logger.Log.Warn("Failed to clear track_artists association", zap.Error(err))
	}

	// Step 5c: Wipe any PlayHistory references
	w.db.Unscoped().Where("track_id = ?", track.ID).Delete(&models.PlayHistory{})

	// Step 5d: Remove from playlists (if you have a playlist_tracks join table, raw SQL is the safest way to clear it without loading all playlists)
	w.db.Exec("DELETE FROM playlist_tracks WHERE track_id = ?", track.ID)

	// Step 5e: Finally, Hard delete the track itself
	if err := w.db.Unscoped().Delete(&track).Error; err != nil {
		logger.Log.Error("Failed to hard delete track from DB", zap.Error(err), zap.Uint("track_id", payload.TrackID))
		return err
	}

	logger.Log.Info("Track completely wiped successfully", zap.Uint("track_id", payload.TrackID))
	return nil
}
