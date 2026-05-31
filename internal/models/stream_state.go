package models

import (
	"time"

	"github.com/google/uuid"
)

// StreamState represents the real-time playback state of a single station pipeline
type StreamState struct {
	ID             uint      `gorm:"primaryKey" json:"-"`
	OrganizationID uuid.UUID `gorm:"type:uuid;index;not null" json:"organization_id"`
	TrackID        uint      `json:"track_id"`                                                         // What song is currently playing?
	BroadcastMode  string    `gorm:"type:varchar(20);default:'autodj';not null" json:"broadcast_mode"` // autodj vs live
	StartedAt      time.Time `json:"started_at"`                                                       // When did the current item start playing? (For seek calculations)

	// Crucial for keeping HLS segment continuity across engine restarts
	Sequence int `gorm:"column:hls_media_sequence;not null;default:0" json:"hls_media_sequence"`

	UpdatedAt time.Time `gorm:"column:last_heartbeat" json:"last_heartbeat"` // Monitors pipeline lifecycle
}

// TableName overrides GORM's default pluralization strategy
func (StreamState) TableName() string {
	return "stream_state"
}
