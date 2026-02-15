package models

import (
	"time"

	"gorm.io/gorm"
)

// Track represents a music file stored in B2
type Track struct {
	gorm.Model `json:"-"` // Hide Model fields from direct JSON if preferred, or see below

	// Explicitly expose ID from gorm.Model if you want it lowercase
	ID uint `gorm:"primarykey" json:"id"`

	// Core Metadata
	Key            string `gorm:"uniqueIndex;not null" json:"key"`
	Title          string `gorm:"index" json:"title"`
	Artist         string `gorm:"index" json:"artist"`
	Album          string `json:"album"`
	Genre          string `gorm:"index" json:"genre"`
	Style          string `gorm:"index" json:"style"`
	Year           string `json:"year"`
	Publisher      string `json:"publisher"`
	ReleaseCountry string `gorm:"size:100" json:"release_country"`
	ArtistCountry  string `gorm:"size:100" json:"artist_country"`

	// Tech Details
	Duration float64 `json:"duration"`
	Bitrate  int     `json:"bitrate"`
	Format   string  `json:"format"`
	FileSize int     `gorm:"column:file_size" json:"file_size"`

	// Acoustic
	BPM          float64 `gorm:"index" json:"bpm"`
	MusicalKey   string  `gorm:"size:10" json:"musical_key"`
	Scale        string  `gorm:"size:10" json:"scale"`
	Danceability float64 `json:"danceability"`
	Loudness     float64 `json:"loudness"`
	Energy       float64 `json:"energy"`

	// Extended tags
	CatalogNumber string `gorm:"index" json:"catalog_number"`
	Mood          string `gorm:"index" json:"mood"`

	// Radio Logic
	PlayCount  int        `gorm:"default:0" json:"play_count"`
	LastPlayed *time.Time `gorm:"index" json:"last_played"`
}

// PlayHistory records every time a track is broadcast
type PlayHistory struct {
	gorm.Model
	TrackID    uint
	Track      Track
	PlayedAt   time.Time  `gorm:"index"`
	PlayCount  int        `gorm:"default:0"`
	LastPlayed *time.Time `gorm:"index"`
}
