package models

import (
	"time"

	"gorm.io/gorm"
)

// 1. Artist represents a music creator
type Artist struct {
	gorm.Model `json:"-"`
	ID         uint `gorm:"primarykey" json:"id"`

	Name          string `gorm:"uniqueIndex;not null" json:"name"`
	ArtistCountry string `gorm:"size:100" json:"artist_country"`

	// Relationships
	Albums []Album `json:"albums,omitempty"`
	Tracks []Track `json:"tracks,omitempty"`
}

// 2. Album represents a collection of tracks or a release
type Album struct {
	gorm.Model `json:"-"`
	ID         uint `gorm:"primarykey" json:"id"`

	Title          string `gorm:"index;not null" json:"title"`
	Year           string `json:"year"`
	Publisher      string `json:"publisher"`
	CatalogNumber  string `gorm:"index" json:"catalog_number"`
	ReleaseCountry string `gorm:"size:100" json:"release_country"`

	// Relationships
	ArtistID uint    `gorm:"index;not null" json:"artist_id"`
	Artist   Artist  `json:"artist,omitempty"`
	Tracks   []Track `json:"tracks,omitempty"`
}

// 3. Track represents a music file stored in B2
type Track struct {
	gorm.Model `json:"-"`
	ID         uint `gorm:"primarykey" json:"id"`

	// Core Metadata
	Key   string `gorm:"uniqueIndex;not null" json:"key"`
	Title string `gorm:"index" json:"title"`

	// ⚡️ RELATIONAL LINKS (Replaces flat strings)
	ArtistID uint   `gorm:"index;not null" json:"artist_id"`
	Artist   Artist `json:"artist,omitempty"`

	AlbumID *uint `gorm:"index" json:"album_id"` // Pointer (*) so tracks can be Singles without an album
	Album   Album `json:"album,omitempty"`

	// Curation Tags
	Genre string `gorm:"index" json:"genre"`
	Style string `gorm:"index" json:"style"`
	Mood  string `gorm:"index" json:"mood"`

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

	// Radio Logic
	PlayCount  int        `gorm:"default:0" json:"play_count"`
	LastPlayed *time.Time `gorm:"index" json:"last_played"`
}

type PlayHistory struct {
	gorm.Model
	TrackID    uint
	Track      Track
	PlayedAt   time.Time  `gorm:"index"`
	PlayCount  int        `gorm:"default:0"`
	LastPlayed *time.Time `gorm:"index"`
}
