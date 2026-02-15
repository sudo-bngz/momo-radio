package models

import (
	"time"

	"gorm.io/gorm"
)

// RuleSet defines the criteria for intelligent AutoDJ selection.
type RuleSet struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// --- Metadata ---
	Name string `gorm:"type:varchar(255);not null;uniqueIndex" json:"name"` // e.g., "Deep House Peak Hour"

	// --- Selection Logic ---
	// Mode determines the algorithm: "starvation", "harmonic", "random"
	Mode string `gorm:"type:varchar(50);default:'starvation'" json:"mode"`

	// --- Criteria Filters ---
	Genre  string `gorm:"type:varchar(100)" json:"genre"`
	Styles string `gorm:"type:text" json:"styles"` // Stored as CSV: "Dub,Deep,Minimal"

	// Using float64 for BPM precision
	MinBPM float64 `gorm:"type:numeric(5,2);default:0" json:"min_bpm"`
	MaxBPM float64 `gorm:"type:numeric(5,2);default:0" json:"max_bpm"`

	MinYear int `gorm:"type:int;default:0" json:"min_year"`
	MaxYear int `gorm:"type:int;default:0" json:"max_year"`

	// --- Relationships ---
	// One RuleSet can be assigned to multiple calendar slots
	Schedules []Schedule `gorm:"foreignKey:RuleSetID" json:"schedules,omitempty"`
}
