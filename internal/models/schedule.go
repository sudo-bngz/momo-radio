package models

import (
	"time"

	"gorm.io/gorm"
)

type Schedule struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Configuration
	Name     string `gorm:"uniqueIndex;not null" json:"name"` // e.g., "Morning Coffee"
	IsActive bool   `gorm:"default:true" json:"is_active"`

	// Timing
	Days  string `json:"days"`  // "Mon,Tue,Wed,Thu,Fri"
	Start string `json:"start"` // "07:00"
	End   string `json:"end"`   // "10:00"

	// Content Rules (The Vibe)
	Genre     string  `json:"genre"`    // e.g. "Electronic"
	Styles    string  `json:"styles"`   // e.g. "Downtempo, Lo-Fi" (Comma separated)
	MinYear   int     `json:"min_year"` // e.g. 1990
	MaxYear   int     `json:"max_year"` // e.g. 2005
	MinBPM    float64 `json:"min_bpm"`
	MaxBPM    float64 `json:"max_bpm"`
	Publisher string  `json:"publisher"` // Optional label filter
}
