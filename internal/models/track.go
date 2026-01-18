package models

import (
	"time"

	"gorm.io/gorm"
)

// Track represents a music file stored in B2
type Track struct {
	gorm.Model

	// Core Metadata
	Key            string `gorm:"uniqueIndex;not null"` // The B2 Filepath (music/...)
	Title          string `gorm:"index"`
	Artist         string `gorm:"index"`
	Album          string
	Genre          string `gorm:"index"`
	Style          string `gorm:"index"`
	Year           string
	Publisher      string // Label
	ReleaseCountry string `gorm:"size:100"`
	ArtistCountry  string `gorm:"size:100"`

	// Tech Details
	Duration float64 // In seconds (extracted via ffprobe)
	Bitrate  int
	Format   string // mp3, flac, etc.

	// Acoustic
	BPM          float64 `gorm:"index"`   // e.g., 123.96
	MusicalKey   string  `gorm:"size:10"` // e.g., "D", "G#"
	Scale        string  `gorm:"size:10"` // e.g., "major", "minor"
	Danceability float64 // Score from 0 to 3+
	Loudness     float64 // average_loudness (0.0 to 1.0)
	Energy       float64 // Derived or integrated loudness (LUFS)

	// Extended tags
	CatalogNumber string `gorm:"index"` // e.g., "TOYT009"
	Mood          string `gorm:"index"` // Derived: "Calm", "Energetic", "Dark", etc.

	// Radio Logic
	PlayCount  int        `gorm:"default:0"`
	LastPlayed *time.Time `gorm:"index"`
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
