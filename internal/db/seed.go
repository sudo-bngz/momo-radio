package database

import (
	"log"
	"momo-radio/internal/models"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// SeedSchedules populates the DB with a full 24/7 Electronic Radio grid
func SeedSchedules(db *gorm.DB) {
	schedules := []models.Schedule{
		// --- MORNING (06:00 - 10:00) ---
		{
			Name:     "Morning Haze",
			Days:     "Mon,Tue,Wed,Thu,Fri",
			Start:    "06:00",
			End:      "10:00",
			Genre:    "Electronic",
			Styles:   "Ambient, Drone, New Age, Berlin-School, Field Recording",
			MinBPM:   0,
			MaxBPM:   100,
			IsActive: true,
		},
		{
			Name:     "Balearic Breakfast",
			Days:     "Sat,Sun",
			Start:    "07:00",
			End:      "11:00",
			Genre:    "Electronic",
			Styles:   "Balearic, Downtempo, Easy Listening, Trip Hop",
			MinBPM:   80,
			MaxBPM:   115,
			IsActive: true,
		},

		// --- WORKDAY (10:00 - 13:00) ---
		{
			Name:     "Deep Space",
			Days:     "Mon,Wed,Fri",
			Start:    "10:00",
			End:      "13:00",
			Genre:    "Electronic",
			Styles:   "Deep Techno, Dub Techno, Minimal, Minimal Techno, IDM",
			MinBPM:   110,
			MaxBPM:   126,
			IsActive: true,
		},
		{
			Name:     "Micro House",
			Days:     "Tue,Thu",
			Start:    "10:00",
			End:      "13:00",
			Genre:    "Electronic",
			Styles:   "Deep House, Tech House, Deep Tech, Minimal",
			MinBPM:   118,
			MaxBPM:   126,
			IsActive: true,
		},

		// --- AFTERNOON (13:00 - 17:00) ---
		{
			Name:     "Glitch & Breaks",
			Days:     "Mon,Tue,Wed,Thu,Fri",
			Start:    "13:00",
			End:      "17:00",
			Genre:    "Electronic",
			Styles:   "Glitch, Broken Beat, Leftfield, IDM, Abstract, Electro",
			IsActive: true,
		},

		// --- SUNSET (17:00 - 21:00) ---
		{
			Name:     "Synth Horizon",
			Days:     "Mon,Tue,Wed,Thu",
			Start:    "17:00",
			End:      "21:00",
			Genre:    "Electronic",
			Styles:   "Synth-pop, Synthwave, Disco, Italo-Disco, Hi NRG, Dance-pop",
			MinBPM:   100,
			MaxBPM:   128,
			IsActive: true,
		},
		{
			Name:     "Friday Starter",
			Days:     "Fri",
			Start:    "17:00",
			End:      "21:00",
			Genre:    "Electronic",
			Styles:   "Big Beat, Breakbeat, Breaks, UK Funky, Electro House",
			MinBPM:   125,
			MaxBPM:   135,
			IsActive: true,
		},

		// --- PRIME TIME (21:00 - 00:00) ---
		{
			Name:     "The Warehouse",
			Days:     "Fri,Sat",
			Start:    "21:00",
			End:      "00:00",
			Genre:    "Electronic",
			Styles:   "Techno, Hard Techno, Industrial, Acid, Acid House",
			MinBPM:   130,
			MaxBPM:   145,
			IsActive: true,
		},
		{
			Name:     "UK Bass Culture",
			Days:     "Wed",
			Start:    "21:00",
			End:      "00:00",
			Genre:    "Electronic",
			Styles:   "Dubstep, Grime, UK Garage, Speed Garage, Bass Music",
			IsActive: true,
		},
		{
			Name:     "House Nation",
			Days:     "Thu",
			Start:    "21:00",
			End:      "00:00",
			Genre:    "Electronic",
			Styles:   "House, Garage House, Italo House, Euro House, Acid House",
			IsActive: true,
		},

		// --- LATE NIGHT (00:00 - 05:00) ---
		{
			Name:     "Trance State",
			Days:     "Fri,Sat",
			Start:    "00:00",
			End:      "05:00",
			Genre:    "Electronic",
			Styles:   "Trance, Progressive Trance, Hard Trance, Goa Trance, Psychedelic",
			MinBPM:   135,
			MaxBPM:   150,
			IsActive: true,
		},
		{
			Name:     "Hardcore Energy",
			Days:     "Sun",
			Start:    "22:00",
			End:      "02:00",
			Genre:    "Electronic",
			Styles:   "Hardcore, Hardstyle, Hard House",
			MinBPM:   150,
			MaxBPM:   190,
			IsActive: true,
		},
		{
			Name:     "Jungle Vibes",
			Days:     "Tue",
			Start:    "22:00",
			End:      "01:00",
			Genre:    "Electronic",
			Styles:   "Drum n Bass, Breakbeat, Bass Music",
			MinBPM:   160,
			MaxBPM:   180,
			IsActive: true,
		},

		// --- OVERNIGHT (02:00 - 06:00) ---
		{
			Name:     "Experimental Signal",
			Days:     "Mon,Tue,Wed,Thu,Sun",
			Start:    "01:00",
			End:      "06:00",
			Genre:    "Electronic",
			Styles:   "Dark Ambient, Drone, Noise, Harsh Noise Wall, Musique Concrète, Sound Collage, Industrial",
			IsActive: true,
		},
	}

	log.Printf("🌱 Seeding %d Electronic Schedules...", len(schedules))
	for _, s := range schedules {
		// UPSERT based on 'Name' to prevent duplicates on restart
		db.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "name"}},
			DoNothing: true,
		}).Create(&s)
	}
}
