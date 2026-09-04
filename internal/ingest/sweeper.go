package ingest

import (
	"context"
	"time"

	"github.com/hibiken/asynq"
	"go.uber.org/zap"

	"momo-radio/internal/logger"
	"momo-radio/internal/models"
)

const TypeSweepOrphanedTracks = "maintenance:sweep_orphaned_tracks"

// HandleSweepOrphanedTask finds tracks stuck in 'pending' or 'processing'
// for more than 1 hour and marks them as 'failed'.
func (w *Worker) HandleSweepOrphanedTask(ctx context.Context, t *asynq.Task) error {
	logger.Log.Info("Starting sweep for orphaned tracks...")

	// Define the threshold (e.g., anything older than 1 hour is considered dead)
	threshold := time.Now().Add(-1 * time.Hour)

	result := w.db.DB.Model(&models.Track{}).
		Where("processing_status IN ? AND updated_at < ?", []string{"pending", "processing"}, threshold).
		Updates(map[string]interface{}{
			"processing_status": "failed", // ⚡️ Kept only the actual column
			"updated_at":        time.Now(),
		})

	if result.Error != nil {
		logger.Log.Error("Failed to sweep orphaned tracks", zap.Error(result.Error))
		return result.Error
	}

	if result.RowsAffected > 0 {
		logger.Log.Info("Swept orphaned tracks", zap.Int64("count", result.RowsAffected))
	} else {
		logger.Log.Info("No orphaned tracks found")
	}

	return nil
}
