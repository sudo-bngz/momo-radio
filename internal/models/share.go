package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Share struct {
	ID             uint           `gorm:"primaryKey" json:"id"`
	OrganizationID uuid.UUID      `gorm:"type:uuid;not null;index" json:"organization_id"`
	TrackID        uint           `gorm:"not null;index" json:"track_id"`
	Track          Track          `gorm:"foreignKey:TrackID" json:"track,omitempty"`
	Token          string         `gorm:"uniqueIndex;size:32;not null" json:"token"`
	AllowDownload  bool           `gorm:"default:false" json:"allow_download"`
	ExpiresAt      *time.Time     `json:"expires_at"`
	PlayCount      int64          `gorm:"default:0" json:"play_count"`
	DownloadCount  int64          `gorm:"default:0" json:"download_count"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
}
