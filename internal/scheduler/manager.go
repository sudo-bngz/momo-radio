package scheduler

import (
	"log"
	"strings"
	"time"

	"momo-radio/internal/models"

	"gorm.io/gorm"
)

// Manager handles time-based calendar events backed by the Database.
type Manager struct {
	db *gorm.DB
}

// NewManager creates a new DB-backed scheduler manager.
func NewManager(db *gorm.DB) *Manager {
	return &Manager{db: db}
}

// GetCurrentSchedule queries the DB to find out what should be on air right now.
// It returns a Schedule object with its attached Playlist or RuleSet.
func (m *Manager) GetCurrentSchedule() *models.Schedule {
	now := time.Now()

	// 1. Get current time context
	weekday := now.Weekday().String()[0:3] // e.g., "Mon", "Tue"
	currentTime := now.Format("15:04")     // e.g., "14:30"

	var schedules []models.Schedule

	// 2. Fetch ALL active schedules and preload their Targets.
	// Preloading means the DB fetches the associated Playlist or RuleSet automatically.
	err := m.db.Preload("Playlist").Preload("RuleSet").Where("is_active = ?", true).Find(&schedules).Error
	if err != nil {
		log.Printf("⚠️ Error fetching schedules: %v", err)
		return m.fallbackSchedule()
	}

	// 3. Find the matching slot
	for i := range schedules {
		slot := schedules[i] // Use index to avoid pointer issues in loops

		// A. Check Day
		if !strings.Contains(slot.Days, weekday) {
			continue
		}

		// B. Check Time
		if m.isTimeMatch(slot.StartTime, slot.EndTime, currentTime) {
			return &slot
		}
	}

	// 4. No Match Found? Return Default.
	return m.fallbackSchedule()
}

// fallbackSchedule returns the default rotation when the calendar is empty.
func (m *Manager) fallbackSchedule() *models.Schedule {
	return &models.Schedule{
		Name:      "General Rotation",
		IsActive:  true,
		StartTime: "00:00",
		EndTime:   "23:59",
		// We provide an empty RuleSet. The DJ package will see this
		// and know it means "play absolutely anything in the library."
		RuleSet: &models.RuleSet{
			Name: "Unrestricted AutoDJ",
		},
	}
}

// isTimeMatch handles standard ranges (09:00-11:00) and crossover ranges (22:00-02:00).
func (m *Manager) isTimeMatch(start, end, current string) bool {
	if start == "" || end == "" {
		return false
	}
	if start <= end {
		// Standard: Start <= Current < End
		return current >= start && current < end
	}
	// Crossover over midnight: (Current >= Start) OR (Current < End)
	return current >= start || current < end
}
