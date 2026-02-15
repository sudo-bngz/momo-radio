package models

import (
	"time"

	"gorm.io/gorm"
)

// Playlist represents a curated collection of tracks
type Playlist struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"` // Hiding DeletedAt from the API

	Name          string  `json:"name" gorm:"not null"`
	Description   string  `json:"description"`
	Color         string  `json:"color" gorm:"default:'#3182ce'"`
	TotalDuration int     `json:"total_duration"`
	Tracks        []Track `json:"tracks" gorm:"many2many:playlist_tracks;"`
}

// PlaylistTrack is the join table that stores the specific order of tracks
type PlaylistTrack struct {
	PlaylistID uint `gorm:"primaryKey" json:"playlist_id"`
	TrackID    uint `gorm:"primaryKey" json:"track_id"`
	SortOrder  int  `json:"sort_order"`
}

// ScheduleSlot represents a playlist assigned to a specific time on the calendar
type ScheduleSlot struct {
	// FIX: Unroll here too for consistency
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	PlaylistID uint      `json:"playlist_id" gorm:"index"`
	Playlist   Playlist  `json:"playlist"`
	StartTime  time.Time `json:"start_time" gorm:"index"`
	EndTime    time.Time `json:"end_time" gorm:"index"`
	IsReplay   bool      `json:"is_replay" gorm:"default:false"`
}
