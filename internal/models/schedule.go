package models

import "gorm.io/gorm"

type Schedule struct {
	gorm.Model
	Name  string `json:"name"`
	Days  string `json:"days"`  // Comma-separated: "Mon,Tue,Wed"
	Start string `json:"start"` // HH:MM (24h format)
	End   string `json:"end"`   // HH:MM (24h format)

	// Filtering Criteria
	Genre     string `json:"genre"`     // Broad Genre (e.g., "Electronic")
	Styles    string `json:"styles"`    // Comma-separated (e.g., "Dub Techno,Deep House")
	Publisher string `json:"publisher"` // Label (e.g., "Basic Channel")
	Artists   string `json:"artists"`   // Comma-separated (e.g., "Maurizio,Rhythm & Sound")
	MinYear   int    `json:"min_year"`
	MaxYear   int    `json:"max_year"`

	IsActive bool `json:"is_active" gorm:"default:true"`
}
