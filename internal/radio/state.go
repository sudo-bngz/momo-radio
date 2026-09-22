package radio

import (
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
	"gorm.io/gorm"

	"momo-radio/internal/logger"
	"momo-radio/internal/models"
)

const (
	ModeAutoDJ = "autodj"
	ModeLive   = "live"
)

type StateManager struct {
	db *gorm.DB
}

func NewStateManager(db *gorm.DB) *StateManager {
	return &StateManager{db: db}
}

// GetCurrentState reads the DB to see where the previous streamer left off FOR THIS TENANT
func (sm *StateManager) GetCurrentState(orgID uuid.UUID) (*models.StreamState, error) {
	var state models.StreamState

	// Ensure new tenants get a fresh state row defaulting to AutoDJ mode
	err := sm.db.Where(models.StreamState{OrganizationID: orgID}).
		FirstOrCreate(&state, models.StreamState{
			OrganizationID: orgID,
			Sequence:       0,
			TrackID:        0,
			BroadcastMode:  ModeAutoDJ, // ⚡️ Default to scheduled playback
			StartedAt:      time.Now(),
			LastHeartbeat:  time.Now(), // Initialize the heartbeat
		}).Error

	if err != nil {
		logger.Log.Error("Failed to fetch or create stream state",
			zap.String("org_id", orgID.String()),
			zap.Error(err),
		)
	}

	return &state, err
}

// UpdateTrack is called every time a new track starts FOR THIS TENANT
func (sm *StateManager) UpdateTrack(orgID uuid.UUID, trackID uint, sequence int) error {
	err := sm.db.Model(&models.StreamState{}).
		Where("organization_id = ?", orgID).
		Updates(map[string]interface{}{
			"track_id":           trackID,
			"started_at":         time.Now(),
			"hls_media_sequence": sequence,
			"last_heartbeat":     time.Now(), // ⚡️ FIXED: Update your custom heartbeat column
		}).Error

	if err != nil {
		logger.Log.Error("Failed to update track in state manager",
			zap.String("org_id", orgID.String()),
			zap.Uint("track_id", trackID),
			zap.Error(err),
		)
	} else {
		logger.Log.Debug("Stream state updated with new track",
			zap.String("org_id", orgID.String()),
			zap.Uint("track_id", trackID),
		)
	}

	return err
}

// IncrementSequence is called every time a new .ts segment is generated
func (sm *StateManager) IncrementSequence(orgID uuid.UUID, newSequence int) {
	err := sm.db.Model(&models.StreamState{}).
		Where("organization_id = ?", orgID).
		Updates(map[string]interface{}{
			"hls_media_sequence": newSequence,
			"last_heartbeat":     time.Now(), // ⚡️ FIXED: Update your custom heartbeat column
		}).Error

	if err != nil {
		// Only log this as a warning so it doesn't spam your error tracking if the DB is momentarily locked
		logger.Log.Warn("Failed to increment HLS sequence in state manager",
			zap.String("org_id", orgID.String()),
			zap.Int("new_sequence", newSequence),
			zap.Error(err),
		)
	}
}

// SetBroadcastMode switches the engine between 'autodj' and 'live' when a stream connects/disconnects
func (sm *StateManager) SetBroadcastMode(orgID uuid.UUID, mode string) error {
	err := sm.db.Model(&models.StreamState{}).
		Where("organization_id = ?", orgID).
		Updates(map[string]interface{}{
			"broadcast_mode": mode,
			"last_heartbeat": time.Now(), // ⚡️ FIXED: Update your custom heartbeat column
		}).Error

	if err != nil {
		logger.Log.Error("Failed to update broadcast mode",
			zap.String("org_id", orgID.String()),
			zap.String("mode", mode),
			zap.Error(err),
		)
	} else {
		logger.Log.Info("Broadcast mode successfully switched",
			zap.String("org_id", orgID.String()),
			zap.String("mode", mode),
		)
	}

	return err
}
