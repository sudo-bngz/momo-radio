// internal/models/schedule.go
package models

import (
	"time"

	"gorm.io/gorm"
)

// Schedule defines WHEN something plays (The Station Manager)
type Schedule struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"` // Hidden from JSON responses

	// --- Identification ---
	Name     string `gorm:"type:varchar(255);not null" json:"name"`
	IsActive bool   `gorm:"default:true" json:"is_active"`

	// --- Timing ---
	Days      string `gorm:"type:varchar(50);not null" json:"days"`            // e.g., "Mon,Tue,Wed"
	StartTime string `gorm:"type:varchar(5);not null;index" json:"start_time"` // e.g., "22:00"
	EndTime   string `gorm:"type:varchar(5);not null;index" json:"end_time"`   // e.g., "02:00"

	// --- The Target (What to play) ---
	// Pointers are used so these can be NULL in Postgres.
	// A schedule slot points to EITHER a Playlist OR a RuleSet.
	PlaylistID *uint     `gorm:"index" json:"playlist_id"`
	Playlist   *Playlist `gorm:"foreignKey:PlaylistID" json:"playlist,omitempty"`

	RuleSetID *uint    `gorm:"index" json:"ruleset_id"`
	RuleSet   *RuleSet `gorm:"foreignKey:RuleSetID" json:"ruleset,omitempty"`
}
