package models

import (
	"time"

	"gorm.io/gorm"
)

// Track represents a music file stored in B2
type Track struct {
	gorm.Model

	// Core Metadata
	Key       string `gorm:"uniqueIndex;not null"` // The B2 Filepath (music/...)
	Title     string `gorm:"index"`
	Artist    string `gorm:"index"`
	Album     string
	Genre     string `gorm:"index"`
	Year      string
	Publisher string // Label

	// Tech Details
	Duration float64 // In seconds (extracted via ffprobe)
	Bitrate  int
	Format   string // mp3, flac, etc.

	// Radio Logic
	LastPlayedAt *time.Time `gorm:"index"` // Nullable, helps with rotation logic
	PlayCount    uint       `gorm:"default:0"`
}

// PlayHistory records every time a track is broadcast
type PlayHistory struct {
	gorm.Model
	TrackID       uint
	Track         Track
	PlayedAt      time.Time `gorm:"index"`
	ListenerCount int       // Optional: Snapshotted from Icecast at playtime
}
