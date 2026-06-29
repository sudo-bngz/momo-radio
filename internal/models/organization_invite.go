package models

import (
	"time"

	"github.com/google/uuid"
)

type OrganizationInvite struct {
	ID             uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	OrganizationID uuid.UUID  `gorm:"type:uuid;not null;index" json:"organization_id"`
	Email          string     `gorm:"type:varchar(255);not null;index" json:"email"`
	Role           string     `gorm:"type:varchar(50);not null" json:"role"` // admin, editor, viewer
	Token          string     `gorm:"type:varchar(64);uniqueIndex;not null" json:"token"`
	ExpiresAt      time.Time  `json:"expires_at"`
	AcceptedAt     *time.Time `json:"accepted_at"` // Null means pending
	CreatedAt      time.Time  `json:"created_at"`

	// Optional relation for preloading
	Organization Organization `gorm:"foreignKey:OrganizationID" json:"-"`
}
