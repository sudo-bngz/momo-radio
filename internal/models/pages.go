// internal/models/public_page.go
package models

import (
	"time"

	"github.com/google/uuid"
)

type PublicPage struct {
	OrganizationID uuid.UUID `gorm:"type:uuid;primaryKey" json:"organization_id"`

	// Appearance
	ThemeMode   string `gorm:"type:varchar(20);default:'dark'" json:"theme_mode"`
	AccentColor string `gorm:"type:varchar(20);default:'#ff0055'" json:"accent_color"`
	CustomCSS   string `gorm:"type:text" json:"custom_css"` // The MySpace nostalgia

	// Hydra Visuals
	VisualMode         string `gorm:"type:varchar(20);default:'preset'" json:"visual_mode"` // 'preset' or 'custom'
	HydraPreset        string `gorm:"type:varchar(50);default:'oscillator'" json:"hydra_preset"`
	HydraCode          string `gorm:"type:text" json:"hydra_code"` // Raw JS for the visualizer
	BackgroundImageURL string `json:"background_image_url" gorm:"type:text"`

	// Content
	LogoURL string `gorm:"type:varchar(255)" json:"logo_url"`
	Bio     string `gorm:"type:text" json:"bio"`

	UpdatedAt time.Time `json:"updated_at"`
}
