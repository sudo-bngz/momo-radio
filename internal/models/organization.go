package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Organization represents a single Radio Station (Tenant)
type Organization struct {
	ID        uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Name      string         `gorm:"not null" json:"name"`
	Plan      string         `gorm:"default:'free'" json:"plan"` // free, pro, enterprise
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Members []OrganizationUser `json:"members,omitempty"`
}

// User replaces the legacy Users table. ID must match Supabase auth.users.id
type User struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	Email     string    `gorm:"uniqueIndex;not null" json:"email"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	Organizations []OrganizationUser `json:"organizations,omitempty"`
}

// OrganizationUser is the RBAC pivot table
type OrganizationUser struct {
	OrganizationID uuid.UUID `gorm:"type:uuid;primaryKey" json:"organization_id"`
	UserID         uuid.UUID `gorm:"type:uuid;primaryKey" json:"user_id"`
	Role           string    `gorm:"type:varchar(20);not null;default:'viewer'" json:"role"` // owner, admin, dj, viewer

	Organization Organization `gorm:"foreignKey:OrganizationID" json:"organization,omitempty"`
	User         User         `gorm:"foreignKey:UserID" json:"user,omitempty"`
}
