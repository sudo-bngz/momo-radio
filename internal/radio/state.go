package radio

import (
	"momo-radio/internal/models"
	"time"

	"gorm.io/gorm"
)

type StateManager struct {
	db *gorm.DB
}

func NewStateManager(db *gorm.DB) *StateManager {
	// Ensure the singleton row exists on startup
	db.Exec("INSERT INTO stream_state (id, sequence, track_id, started_at, updated_at) VALUES (1, 0, 0, NOW(), NOW()) ON CONFLICT (id) DO NOTHING")
	return &StateManager{db: db}
}

// GetCurrentState reads the DB to see where the previous streamer left off
func (sm *StateManager) GetCurrentState() (*models.StreamState, error) {
	var state models.StreamState
	err := sm.db.First(&state, 1).Error
	return &state, err
}

// UpdateState is called every time a new track starts
func (sm *StateManager) UpdateTrack(trackID uint, sequence int) error {
	return sm.db.Model(&models.StreamState{ID: 1}).Updates(map[string]interface{}{
		"track_id":           trackID,
		"started_at":         time.Now(),
		"hls_media_sequence": sequence,
		"updated_at":         time.Now(),
	}).Error
}

// IncrementSequence is called every time a new .ts segment is generated (e.g. every 10s)
// This is critical so the new container continues counting (501, 502...) instead of resetting to 0.
func (sm *StateManager) IncrementSequence(newSequence int) {
	sm.db.Model(&models.StreamState{ID: 1}).Update("hls_media_sequence", newSequence)
	sm.db.Model(&models.StreamState{ID: 1}).Update("updated_at", time.Now())
}
