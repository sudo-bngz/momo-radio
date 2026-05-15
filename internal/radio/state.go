package radio

import (
	"time"

	"github.com/google/uuid" // ⚡️ REQUIRED FOR MULTI-TENANT
	"gorm.io/gorm"

	"momo-radio/internal/models"
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

	// FirstOrCreate ensures that if a new tenant boots up for the first time,
	// they get a fresh state row automatically generated for them.
	err := sm.db.Where(models.StreamState{OrganizationID: orgID}).
		FirstOrCreate(&state, models.StreamState{
			OrganizationID: orgID,
			Sequence:       0,
			TrackID:        0,
			StartedAt:      time.Now(),
		}).Error

	return &state, err
}

// UpdateTrack is called every time a new track starts FOR THIS TENANT
func (sm *StateManager) UpdateTrack(orgID uuid.UUID, trackID uint, sequence int) error {
	// Target the specific tenant's state row
	return sm.db.Model(&models.StreamState{}).
		Where("organization_id = ?", orgID).
		Updates(map[string]interface{}{
			"track_id":           trackID,
			"started_at":         time.Now(),
			"hls_media_sequence": sequence, // Ensure this matches your DB column name (either sequence or hls_media_sequence)
			"updated_at":         time.Now(),
		}).Error
}

// IncrementSequence is called every time a new .ts segment is generated
// This is critical so the new container continues counting (501, 502...) instead of resetting to 0.
func (sm *StateManager) IncrementSequence(orgID uuid.UUID, newSequence int) {
	// ⚡️ Target the specific tenant's state row
	sm.db.Model(&models.StreamState{}).
		Where("organization_id = ?", orgID).
		Updates(map[string]interface{}{
			"hls_media_sequence": newSequence,
			"updated_at":         time.Now(),
		})
}
