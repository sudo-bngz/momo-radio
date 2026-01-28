package dj

import (
	"log"
	"os"
	"strings"
	"sync"
	"time"

	"gopkg.in/yaml.v3"
)

// TimetableConfig matches the new YAML structure
type TimetableConfig struct {
	Defaults  SlotRules             `yaml:"defaults"`
	Timetable map[string][]TimeSlot `yaml:"timetable"`
}

type TimeSlot struct {
	StartHour int      `yaml:"start_hour"`
	EndHour   int      `yaml:"end_hour"`
	Name      string   `yaml:"name"`
	Styles    []string `yaml:"styles"`
	MinBPM    float64  `yaml:"min_bpm"`
	MaxBPM    float64  `yaml:"max_bpm"`
}

type SlotRules struct {
	Name   string   `yaml:"name"`
	Styles []string `yaml:"styles"`
	MinBPM float64  `yaml:"min_bpm"`
	MaxBPM float64  `yaml:"max_bpm"`
}

var (
	currentConfig *TimetableConfig
	timetableMu   sync.RWMutex
	// Fallback if config fails entirely
	fallbackRules = SlotRules{
		Name:   "General Rotation",
		Styles: []string{},
		MinBPM: 0,
		MaxBPM: 0,
	}
)

func LoadTimetable(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}

	var cfg TimetableConfig
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return err
	}

	timetableMu.Lock()
	currentConfig = &cfg
	timetableMu.Unlock()

	log.Printf("📅 Timetable Loaded: Defaults + %d days of schedules", len(cfg.Timetable))
	return nil
}

func GetCurrentSlot(t time.Time) SlotRules {
	timetableMu.RLock()
	defer timetableMu.RUnlock()

	// 1. If config isn't loaded, use hardcoded fallback
	if currentConfig == nil {
		return fallbackRules
	}

	// 2. Identify Day & Hour
	dayName := strings.ToLower(t.Weekday().String())
	hour := t.Hour()

	// 3. Check for Specific Slot
	if slots, ok := currentConfig.Timetable[dayName]; ok {
		for _, slot := range slots {
			if hour >= slot.StartHour && hour < slot.EndHour {
				return SlotRules{
					Name:   slot.Name,
					Styles: slot.Styles,
					MinBPM: slot.MinBPM,
					MaxBPM: slot.MaxBPM,
				}
			}
		}
	}

	// 4. Return the YAML Defaults if no specific slot matches
	// (This allows you to change the fallback behavior via YAML)
	return currentConfig.Defaults
}
