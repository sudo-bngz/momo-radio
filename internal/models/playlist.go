package models

import (
	"time"

	"gorm.io/gorm"
)

// Playlist represents a curated collection of tracks
type Playlist struct {
	gorm.Model
	Name          string  `json:"name" gorm:"not null"`
	Description   string  `json:"description"`
	Color         string  `json:"color" gorm:"default:'#3182ce'"` // For the UI calendar
	TotalDuration int     `json:"total_duration"`                 // In seconds
	Tracks        []Track `json:"tracks" gorm:"many2many:playlist_tracks;order:sort_order"`
}

// PlaylistTrack is the join table that stores the specific order of tracks
type PlaylistTrack struct {
	PlaylistID uint `gorm:"primaryKey"`
	TrackID    uint `gorm:"primaryKey"`
	SortOrder  int  `json:"sort_order"` // Crucial for manual ordering
}

// ScheduleSlot represents a playlist assigned to a specific time on the calendar
type ScheduleSlot struct {
	gorm.Model
	PlaylistID uint      `json:"playlist_id" gorm:"index"`
	Playlist   Playlist  `json:"playlist"`
	StartTime  time.Time `json:"start_time" gorm:"index"`
	EndTime    time.Time `json:"end_time" gorm:"index"`
	IsReplay   bool      `json:"is_replay" gorm:"default:false"`
}
