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
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	ScheduleType string `json:"schedule_type" gorm:"not null;default:'one_time'"`
	Date         string `json:"date"`
	Days         string `json:"days" gorm:"not null;default:'Mon,Tue,Wed,Thu,Fri,Sat,Sun'"`

	IsActive bool `json:"is_active" gorm:"default:true"`
	IsReplay bool `json:"is_replay" gorm:"default:false"`

	StartTime string `json:"start_time" gorm:"type:varchar(5);not null"`
	EndTime   string `json:"end_time" gorm:"type:varchar(5);not null"`

	PlaylistID *uint     `json:"playlist_id" gorm:"index"`
	Playlist   *Playlist `json:"playlist"`

	RuleSetID *uint    `json:"ruleset_id" gorm:"index"`
	RuleSet   *RuleSet `json:"ruleset"`
}
