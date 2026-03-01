package scheduler

import (
	"log"
	"strings"
	"time"

	"momo-radio/internal/models"

	"gorm.io/gorm"
)

type Manager struct {
	db *gorm.DB
}

func NewManager(db *gorm.DB) *Manager {
	return &Manager{db: db}
}

func (m *Manager) GetCurrentSchedule() *models.ScheduleSlot {
	now := time.Now()

	// 1. Get current time context
	todayDate := now.Format("2006-01-02")   // e.g., "2026-03-01"
	todayDay := now.Weekday().String()[0:3] // e.g., "Sun"
	currentTime := now.Format("15:04")      // e.g., "14:30"

	var schedules []models.ScheduleSlot

	err := m.db.Preload("Playlist").Preload("RuleSet").Where("is_active = ?", true).Find(&schedules).Error
	if err != nil {
		log.Printf("⚠️ Error fetching schedules: %v", err)
		return m.fallbackSchedule()
	}

	var bestRecurringMatch *models.ScheduleSlot

	// 2. Find the matching slot
	for i := range schedules {
		slot := &schedules[i]

		// Check if the current time falls within the slot's HH:MM window
		if !m.isTimeMatch(slot.StartTime, slot.EndTime, currentTime) {
			continue
		}

		// --- PRIORITY 1: ONE-TIME EVENT ---
		if slot.ScheduleType == "one_time" && slot.Date == todayDate {
			// A special guest mix or one-time event overrides everything else!
			return slot
		}

		// --- PRIORITY 2: WEEKLY RECURRING EVENT ---
		if slot.ScheduleType == "recurring" && strings.Contains(slot.Days, todayDay) {
			// Save it as a match, but keep looping just in case there is a
			// 'one_time' event overlapping it that should take priority.
			bestRecurringMatch = slot
		}
	}

	// 3. If no one-time event was found, return the recurring one (if any)
	if bestRecurringMatch != nil {
		return bestRecurringMatch
	}

	// 4. No Match Found? Return Default AutoDJ.
	return m.fallbackSchedule()
}

func (m *Manager) fallbackSchedule() *models.ScheduleSlot {
	return &models.ScheduleSlot{
		ScheduleType: "fallback",
		StartTime:    "00:00",
		EndTime:      "23:59",
		RuleSet: &models.RuleSet{
			Name: "Unrestricted AutoDJ",
		},
	}
}

func (m *Manager) isTimeMatch(start, end, current string) bool {
	if start == "" || end == "" {
		return false
	}
	if start <= end {
		return current >= start && current < end
	}
	return current >= start || current < end
}
