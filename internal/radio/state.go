package radio

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

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
		}).Error

	return &state, err
}

// UpdateTrack is called every time a new track starts FOR THIS TENANT
func (sm *StateManager) UpdateTrack(orgID uuid.UUID, trackID uint, sequence int) error {
	return sm.db.Model(&models.StreamState{}).
		Where("organization_id = ?", orgID).
		Updates(map[string]interface{}{
			"track_id":           trackID,
			"started_at":         time.Now(),
			"hls_media_sequence": sequence,
			"updated_at":         time.Now(),
		}).Error
}

// IncrementSequence is called every time a new .ts segment is generated
func (sm *StateManager) IncrementSequence(orgID uuid.UUID, newSequence int) {
	sm.db.Model(&models.StreamState{}).
		Where("organization_id = ?", orgID).
		Updates(map[string]interface{}{
			"hls_media_sequence": newSequence,
			"updated_at":         time.Now(),
		})
}

// SetBroadcastMode switches the engine between 'autodj' and 'live' when a stream connects/disconnects
func (sm *StateManager) SetBroadcastMode(orgID uuid.UUID, mode string) error {
	return sm.db.Model(&models.StreamState{}).
		Where("organization_id = ?", orgID).
		Updates(map[string]interface{}{
			"broadcast_mode": mode,
			"updated_at":     time.Now(),
		}).Error
}
