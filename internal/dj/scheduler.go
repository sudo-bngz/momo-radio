package dj

import (
	"log"
	database "momo-radio/internal/db"
	"momo-radio/internal/models"
	"strings"
	"time"
)

// ActiveCriteria represents the filter we need to apply to the DB
type ActiveCriteria struct {
	Name      string
	Genre     string
	Styles    []string // Parsed from comma-separated string
	Publisher string
	Artists   []string // Parsed from comma-separated string
	MinYear   int
	MaxYear   int
}

// Scheduler handles time-based rules backed by the Database
type Scheduler struct {
	db *database.Client
}

func NewScheduler(db *database.Client) *Scheduler {
	return &Scheduler{db: db}
}

// GetCurrentCriteria checks the DB for active schedules matching now.
func (s *Scheduler) GetCurrentCriteria() *ActiveCriteria {
	now := time.Now()
	weekday := now.Weekday().String()[0:3] // "Mon", "Tue"...
	currentTime := now.Format("15:04")     // HH:MM

	var schedules []models.Schedule
	// Fetch all active schedules
	if err := s.db.DB.Where("is_active = ?", true).Find(&schedules).Error; err != nil {
		log.Printf("⚠️ Error fetching schedules: %v", err)
		return nil
	}

	for _, slot := range schedules {
		// 1. Check Day
		if strings.Contains(slot.Days, weekday) {
			// 2. Check Time
			if s.isTimeMatch(slot.Start, slot.End, currentTime) {
				log.Printf("📅 Schedule Active: %s", slot.Name)

				// Parse comma-separated lists
				var styles []string
				if slot.Styles != "" {
					for _, s := range strings.Split(slot.Styles, ",") {
						trimmed := strings.TrimSpace(s)
						if trimmed != "" {
							styles = append(styles, trimmed)
						}
					}
				}

				var artists []string
				if slot.Artists != "" {
					for _, a := range strings.Split(slot.Artists, ",") {
						trimmed := strings.TrimSpace(a)
						if trimmed != "" {
							artists = append(artists, trimmed)
						}
					}
				}

				return &ActiveCriteria{
					Name:      slot.Name,
					Genre:     slot.Genre,
					Styles:    styles,
					Publisher: slot.Publisher,
					Artists:   artists,
					MinYear:   slot.MinYear,
					MaxYear:   slot.MaxYear,
				}
			}
		}
	}

	return nil
}

func (s *Scheduler) isTimeMatch(start, end, current string) bool {
	if start <= end {
		return current >= start && current < end
	}
	// Cross-midnight slots (e.g., 22:00 to 02:00)
	return current >= start || current < end
}
