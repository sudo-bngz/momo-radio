package database

import (
	"log"
	"momo-radio/internal/models"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// SeedSchedules populates the DB with a full 24/7 radio grid
func SeedSchedules(db *gorm.DB) {
	schedules := []models.Schedule{
		// --- MORNING (06:00 - 10:00) ---
		{
			Name:     "Morning Haze",
			Days:     "Mon,Tue,Wed,Thu,Fri",
			Start:    "06:00",
			End:      "09:00",
			Genre:    "Electronic",
			Styles:   "Ambient, Downtempo, Easy Listening, New Age, Balearic, Berlin-School",
			MinBPM:   60,
			MaxBPM:   100,
			IsActive: true,
		},
		{
			Name:     "Weekend Soul",
			Days:     "Sat,Sun",
			Start:    "07:00",
			End:      "11:00",
			Genre:    "Jazz/Soul",
			Styles:   "Soul, Funk, Fusion, Future Jazz, Rhythm & Blues",
			MinBPM:   80,
			MaxBPM:   115,
			IsActive: true,
		},

		// --- WORKDAY (10:00 - 13:00) ---
		{
			Name:     "Deep Focus",
			Days:     "Mon,Wed,Fri",
			Start:    "09:00",
			End:      "13:00",
			Genre:    "Electronic",
			Styles:   "Deep Techno, Dub Techno, Minimal, IDM, Deep Tech",
			MinBPM:   110,
			MaxBPM:   126,
			IsActive: true,
		},
		{
			Name:     "Office Groove",
			Days:     "Tue,Thu",
			Start:    "09:00",
			End:      "13:00",
			Genre:    "House",
			Styles:   "Deep House, Garage House, Tech House, Progressive House",
			MinBPM:   118,
			MaxBPM:   126,
			IsActive: true,
		},

		// --- AFTERNOON (13:00 - 17:00) ---
		{
			Name:     "Afternoon Digging",
			Days:     "Mon,Tue,Wed,Thu,Fri",
			Start:    "13:00",
			End:      "17:00",
			Genre:    "Eclectic",
			Styles:   "Abstract, Trip Hop, Broken Beat, Leftfield, Experimental, Hip Hop, Turntablism",
			IsActive: true,
		},

		// --- SUNSET (17:00 - 21:00) ---
		{
			Name:     "Sunset Boulevard",
			Days:     "Mon,Tue,Wed,Thu",
			Start:    "17:00",
			End:      "20:00",
			Genre:    "Pop/Disco",
			Styles:   "Synth-pop, Disco, Italo-Disco, Dance-pop, Funk, Synthwave",
			MinBPM:   100,
			MaxBPM:   125,
			IsActive: true,
		},
		{
			Name:     "Friday Warmup",
			Days:     "Fri",
			Start:    "17:00",
			End:      "21:00",
			Genre:    "Electronic",
			Styles:   "Electro, Breaks, Breakbeat, Big Beat, UK Funky, Electro House",
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
			Genre:    "Techno",
			Styles:   "Techno, Hard Techno, Industrial, Acid, Minimal Techno",
			MinBPM:   130,
			MaxBPM:   145,
			IsActive: true,
		},
		{
			Name:     "Urban Night",
			Days:     "Wed",
			Start:    "21:00",
			End:      "00:00",
			Genre:    "Hip Hop",
			Styles:   "Hip Hop, Gangsta, Thug Rap, Grime, Hardcore Hip-Hop, Rap",
			IsActive: true,
		},
		{
			Name:     "Rock Session",
			Days:     "Thu",
			Start:    "21:00",
			End:      "00:00",
			Genre:    "Rock",
			Styles:   "Rock, Indie Rock, Post Rock, Krautrock, Psychedelic Rock, Classic Rock, Art Rock",
			IsActive: true,
		},

		// --- LATE NIGHT / CLUB (00:00 - 05:00) ---
		{
			Name:     "Deep State",
			Days:     "Fri,Sat", // Technically Sat/Sun early morning
			Start:    "00:00",
			End:      "05:00",
			Genre:    "Electronic",
			Styles:   "Trance, Progressive Trance, Hard Trance, Goa Trance, Psychedelic, Hardstyle, Hardcore",
			MinBPM:   135,
			MaxBPM:   155,
			IsActive: true,
		},
		{
			Name:     "Bass Pressure",
			Days:     "Sun", // Sunday night -> Monday morning
			Start:    "22:00",
			End:      "02:00",
			Genre:    "Bass",
			Styles:   "Drum n Bass, Dubstep, UK Garage, Speed Garage, Bass Music",
			MinBPM:   140,
			MaxBPM:   180,
			IsActive: true,
		},

		// --- OVERNIGHT / EXPERIMENTAL (02:00 - 06:00) ---
		{
			Name:     "Night Signal",
			Days:     "Mon,Tue,Wed,Thu",
			Start:    "01:00",
			End:      "06:00",
			Genre:    "Experimental",
			Styles:   "Drone, Dark Ambient, Noise, Glitch, Musique Concrète, Field Recording, Sound Collage, Harsh Noise Wall",
			IsActive: true,
		},
	}

	log.Printf("🌱 Seeding %d Schedules...", len(schedules))
	for _, s := range schedules {
		// UPSERT based on 'Name' to prevent duplicates on restart
		db.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "name"}},
			DoNothing: true, // If it exists, leave it alone.
		}).Create(&s)
	}
}
