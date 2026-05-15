package scheduler

import (
	"log"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"momo-radio/internal/models"
)

type Manager struct {
	db       *gorm.DB
	timezone string
}

// ⚡️ Require timezone on initialization
func NewManager(db *gorm.DB, tz string) *Manager {
	if tz == "" {
		tz = "UTC"
	}
	return &Manager{db: db, timezone: tz}
}

func extractHHMM(t string) string {
	parts := strings.Split(t, "T")
	timePart := parts[len(parts)-1]
	if len(timePart) >= 5 {
		return timePart[:5]
	}
	return t
}

func (m *Manager) GetCurrentSchedule(orgID uuid.UUID) *models.ScheduleSlot {
	loc, err := time.LoadLocation(m.timezone)
	var now time.Time

	if err != nil {
		log.Printf("⚠️ Timezone error loading '%s': %v. Falling back to server default.", m.timezone, err)
		now = time.Now()
	} else {
		now = time.Now().In(loc)
	}

	todayDate := now.Format("2006-01-02")
	todayDay := strings.ToLower(now.Weekday().String()[0:3])
	currentTime := now.Format("15:04")

	var schedules []models.ScheduleSlot

	err = m.db.Preload("Playlist").Preload("RuleSet").
		Where("organization_id = ? AND is_active = ?", orgID, true).
		Find(&schedules).Error

	if err != nil {
		log.Printf("[%s] Error fetching schedules: %v", orgID, err)
		return m.fallbackSchedule()
	}

	var bestRecurringMatch *models.ScheduleSlot

	for i := range schedules {
		slot := &schedules[i]

		start := extractHHMM(slot.StartTime)
		end := extractHHMM(slot.EndTime)

		if !m.isTimeMatch(start, end, currentTime) {
			continue
		}

		dbDate := strings.Split(slot.Date, "T")[0]

		if slot.ScheduleType == "one_time" && dbDate == todayDate {
			log.Printf("[%s] Scheduler: Playing One-Time Event (ID: %d)", orgID, slot.ID)
			return slot
		}

		dbDays := strings.ToLower(slot.Days)
		if slot.ScheduleType == "recurring" && strings.Contains(dbDays, todayDay) {
			bestRecurringMatch = slot
		}
	}

	if bestRecurringMatch != nil {
		log.Printf("[%s] Scheduler: Playing Recurring Event (ID: %d)", orgID, bestRecurringMatch.ID)
		return bestRecurringMatch
	}

	log.Printf("[%s] Scheduler: No events match current time (%s %s %s). Triggering fallback AutoDJ.", orgID, m.timezone, todayDay, currentTime)
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
