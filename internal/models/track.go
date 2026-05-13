package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// 1. Artist represents a music creator
type Artist struct {
	gorm.Model     `json:"-"`
	ID             uint      `gorm:"primarykey" json:"id"`
	OrganizationID uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:idx_org_artist_name" json:"organization_id"`
	Name           string    `gorm:"not null;uniqueIndex:idx_org_artist_name" json:"name"`

	ArtistCountry string `gorm:"size:100" json:"artist_country"`

	// Relationships
	Albums []Album `json:"albums,omitempty"`
	Tracks []Track `json:"tracks,omitempty"`
}

// 2. Album represents a collection of tracks or a release
type Album struct {
	gorm.Model `json:"-"`
	ID         uint `gorm:"primarykey" json:"id"`

	OrganizationID uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:idx_org_album_title" json:"organization_id"`
	ArtistID       uint      `gorm:"not null;uniqueIndex:idx_org_album_title" json:"artist_id"`
	Title          string    `gorm:"not null;uniqueIndex:idx_org_album_title" json:"title"`

	Year           string `json:"year"`
	Publisher      string `json:"publisher"`
	CatalogNumber  string `gorm:"index" json:"catalog_number"`
	ReleaseCountry string `gorm:"size:100" json:"release_country"`
	CoverKey       string `gorm:"size:255" json:"cover_key"`
	CoverURL       string `gorm:"-" json:"cover_url"`

	// Relationships
	Artist Artist  `json:"artist,omitempty"`
	Tracks []Track `json:"tracks,omitempty"`
}

// 3. Track represents a single audio file
type Track struct {
	gorm.Model     `json:"-"`
	OrganizationID uuid.UUID `gorm:"type:uuid;index;not null" json:"organization_id"`
	ID             uint      `gorm:"primarykey" json:"id"`

	// Core Metadata
	Key       string `gorm:"uniqueIndex;not null" json:"key"`
	MasterKey string `gorm:"type:text;not null" json:"master_key"`
	Title     string `gorm:"index" json:"title"`

	ProcessingStatus   string `gorm:"default:'pending';index" json:"processing_status"`
	ProcessingProgress int    `gorm:"default:0" json:"processing_progress"`

	ArtistID uint   `gorm:"index;not null" json:"artist_id"`
	Artist   Artist `json:"artist,omitempty"`

	AlbumID *uint `gorm:"index" json:"album_id"`
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

// 4. PlayHistory represents a single instance of a track being played
type PlayHistory struct {
	gorm.Model
	OrganizationID uuid.UUID `gorm:"type:uuid;index;not null" json:"organization_id"`
	TrackID        uint
	Track          Track
	PlayedAt       time.Time `gorm:"index"`
}
