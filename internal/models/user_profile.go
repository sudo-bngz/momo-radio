package models

import (
	"time"

	"github.com/google/uuid"
)

type UserProfile struct {
	// ID matches the Supabase auth.users UUID
	ID        uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	FirstName string    `gorm:"type:varchar(100)" json:"first_name"`
	LastName  string    `gorm:"type:varchar(100)" json:"last_name"`
	AvatarURL string    `gorm:"type:text" json:"avatar_url"`
	UpdatedAt time.Time `json:"updated_at"`
}
