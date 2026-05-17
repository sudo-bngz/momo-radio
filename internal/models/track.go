package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Artist represents a music creator
type Artist struct {
	gorm.Model     `json:"-"`
	ID             uint      `gorm:"primarykey" json:"id"`
	OrganizationID uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:idx_org_artist_name" json:"organization_id"`
	Name           string    `gorm:"not null;uniqueIndex:idx_org_artist_name" json:"name"`

	// --- Visuals & Biography ---
	ArtistCountry string `gorm:"size:100" json:"artist_country"`
	Bio           string `gorm:"type:text" json:"bio"`
	AvatarURL     string `gorm:"size:512" json:"avatar_url"` // Main profile picture
	HeaderURL     string `gorm:"size:512" json:"header_url"` // Background banner for the detail view

	// --- Extended Profile ---
	Type          string            `gorm:"size:50" json:"type"`            // e.g., "Person", "Group", "Orchestra"
	Aliases       []string          `gorm:"serializer:json" json:"aliases"` // Alternative names/monikers
	ExternalLinks map[string]string `gorm:"serializer:json" json:"links"`   // e.g., {"instagram": "...", "website": "..."}

	// --- External API Integrations ---
	// Indexes added here because we will frequently query: "Do we already have Discogs ID 12345?"
	DiscogsID    string `gorm:"size:100;index" json:"discogs_id"`
	SpotifyID    string `gorm:"size:100;index" json:"spotify_id"`
	AppleMusicID string `gorm:"size:100;index" json:"apple_music_id"`

	// --- Relationships ---
	Albums []Album `gorm:"many2many:album_artists;" json:"albums,omitempty"`
	Tracks []Track `gorm:"many2many:track_artists;" json:"tracks,omitempty"`
}

// 2. Album represents a collection of tracks or a release
type Album struct {
	gorm.Model `json:"-"`
	ID         uint `gorm:"primarykey" json:"id"`

	OrganizationID uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:idx_org_album_title" json:"organization_id"`
	Title          string    `gorm:"not null;uniqueIndex:idx_org_album_title" json:"title"`

	Year           string `json:"year"`
	Publisher      string `json:"publisher"`
	CatalogNumber  string `gorm:"index" json:"catalog_number"`
	ReleaseCountry string `gorm:"size:100" json:"release_country"`
	CoverKey       string `gorm:"size:255" json:"cover_key"`
	CoverURL       string `gorm:"-" json:"cover_url"`

	// Relationships
	Artists []Artist `gorm:"many2many:album_artists;" json:"artists,omitempty"`
	Tracks  []Track  `json:"tracks,omitempty"`
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

	Artists []Artist `gorm:"many2many:track_artists;" json:"artists,omitempty"`

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
