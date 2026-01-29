package database

import (
	"log"
	"momo-radio/internal/models"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// SeedSchedules populates the DB with default shows if empty
func SeedSchedules(db *gorm.DB) {
	schedules := []models.Schedule{
		{
			Name:     "Morning Coffee",
			Days:     "Mon,Tue,Wed,Thu,Fri",
			Start:    "07:00",
			End:      "10:00",
			Genre:    "Electronic",
			Styles:   "Downtempo, Jazz, Lo-Fi",
			IsActive: true,
		},
		{
			Name:     "Techno Bunker",
			Days:     "Fri,Sat",
			Start:    "23:00",
			End:      "05:00",
			Genre:    "Techno",
			Styles:   "Dub Techno, Industrial, Acid",
			MinBPM:   128,
			MaxBPM:   145,
			IsActive: true,
		},
	}

	log.Println("🌱 Seeding Schedules...")
	for _, s := range schedules {
		// Upsert based on Name
		db.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "name"}},
			DoNothing: true, // Or UpdateAll: true if you want to force reset
		}).Create(&s)
	}
}
