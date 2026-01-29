package mix

import (
	"log"
	"strings"
	"time"

	"momo-radio/internal/dj" // Imports the SlotRules struct
	"momo-radio/internal/models"

	"gorm.io/gorm"
)

// Scheduler handles time-based rules backed by the Database.
type Scheduler struct {
	db *gorm.DB
}

// NewScheduler creates a new DB-backed scheduler.
func NewScheduler(db *gorm.DB) *Scheduler {
	return &Scheduler{db: db}
}

// GetCurrentRules checks the DB for active schedules matching the current time.
// NOTE: This method name MUST be 'GetCurrentRules' to match provider.go
func (s *Scheduler) GetCurrentRules() *dj.SlotRules {
	now := time.Now()

	// 1. Get current constraints
	// Weekday: "Mon", "Tue"...
	weekday := now.Weekday().String()[0:3]
	// Time: "15:04"
	currentTime := now.Format("15:04")

	var schedules []models.Schedule

	// 2. Fetch all active schedules
	if err := s.db.Where("is_active = ?", true).Find(&schedules).Error; err != nil {
		log.Printf("⚠️ Error fetching schedules: %v", err)
		return nil
	}

	for _, slot := range schedules {
		// A. Check Day (e.g. "Mon,Tue,Fri")
		if !strings.Contains(slot.Days, weekday) {
			continue
		}

		// B. Check Time
		if s.isTimeMatch(slot.Start, slot.End, currentTime) {
			// Found a match!
			return &dj.SlotRules{
				Name:    slot.Name,
				Genre:   slot.Genre,
				Styles:  splitAndTrim(slot.Styles), // Helper to parse "Techno, Dub"
				MinYear: slot.MinYear,
				MaxYear: slot.MaxYear,
				// Map other fields if your models.Schedule has them:
				// MinBPM: slot.MinBPM,
				// MaxBPM: slot.MaxBPM,
			}
		}
	}

	// No specific schedule found? Return default fallback.
	return &dj.SlotRules{
		Name: "General Rotation",
	}
}

// isTimeMatch handles standard ranges (09:00-11:00) and cross-midnight ranges (23:00-02:00).
func (s *Scheduler) isTimeMatch(start, end, current string) bool {
	if start <= end {
		// Standard: 09:00 to 17:00
		return current >= start && current < end
	}
	// Crossover: 22:00 to 04:00
	// Match if we are after start (23:00) OR before end (01:00)
	return current >= start || current < end
}

// Helper to parse "Techno, Dub, Ambient" into ["Techno", "Dub", "Ambient"]
func splitAndTrim(input string) []string {
	var result []string
	if input == "" {
		return result
	}
	for _, str := range strings.Split(input, ",") {
		if trimmed := strings.TrimSpace(str); trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}
