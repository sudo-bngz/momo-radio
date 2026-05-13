package models

import (
	"time"

	"github.com/google/uuid"
)

// StreamState represents the live status of the radio.
// There is ONE row in this table (ID=1).
type StreamState struct {
	OrganizationID   uuid.UUID `gorm:"type:uuid;index;not null" json:"organization_id"`
	ID               uint      `gorm:"primaryKey" json:"-"`
	TrackID          uint      `json:"track_id"`           // What song is playing?
	StartedAt        time.Time `json:"started_at"`         // When did it start? (To calculate Seek)
	Sequence         int       `json:"hls_media_sequence"` // The current .ts segment number (Crucial for HLS)
	UpdatedAt        time.Time `json:"last_heartbeat"`     // To check if the state is stale
	HLSMediaSequence int       `gorm:"column:hls_media_sequence"`
}

// TableName overrides the default pluralization
func (StreamState) TableName() string {
	return "stream_state"
}
