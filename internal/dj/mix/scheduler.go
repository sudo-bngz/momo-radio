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

// GetCurrentRules queries the DB for the active schedule slot.
func (s *Scheduler) GetCurrentRules() *dj.SlotRules {
	now := time.Now()

	// 1. Get current time context
	weekday := now.Weekday().String()[0:3] // "Mon", "Tue"...
	currentTime := now.Format("15:04")     // "14:30"

	var schedules []models.Schedule

	// 2. Fetch ALL active schedules
	// We fetch all active rows first because handling "Mon,Tue,Wed" and
	// cross-midnight time logic is cleaner in Go than in SQL.
	if err := s.db.Where("is_active = ?", true).Find(&schedules).Error; err != nil {
		log.Printf("⚠️ Error fetching schedules: %v", err)
		return s.fallbackRules()
	}

	// 3. Find the matching slot
	for _, slot := range schedules {
		// A. Check Day
		if !strings.Contains(slot.Days, weekday) {
			continue
		}

		// B. Check Time
		if s.isTimeMatch(slot.Start, slot.End, currentTime) {
			return &dj.SlotRules{
				Name:    slot.Name,
				Genre:   slot.Genre,
				Styles:  s.parseCSV(slot.Styles),
				MinBPM:  slot.MinBPM,
				MaxBPM:  slot.MaxBPM,
				MinYear: slot.MinYear,
				MaxYear: slot.MaxYear,
			}
		}
	}

	// 4. No Match Found? Return Default.
	return s.fallbackRules()
}

// fallbackRules returns the default rotation when no show is scheduled.
func (s *Scheduler) fallbackRules() *dj.SlotRules {
	return &dj.SlotRules{
		Name: "General Rotation",
		// You can define default constraints here if you want
		// e.g., MinBPM: 0, MaxBPM: 200
	}
}

// isTimeMatch handles standard ranges (09:00-11:00) and crossover ranges (22:00-02:00).
func (s *Scheduler) isTimeMatch(start, end, current string) bool {
	if start <= end {
		// Standard: Start < Current < End
		return current >= start && current < end
	}
	// Crossover: (Current > Start) OR (Current < End)
	return current >= start || current < end
}

// parseCSV helper splits "Techno, Dub" into ["Techno", "Dub"]
func (s *Scheduler) parseCSV(input string) []string {
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
