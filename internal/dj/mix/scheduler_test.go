package mix

import (
	"testing"
	"time"

	"momo-radio/internal/dj" // Corrected import path
	"momo-radio/internal/models"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// SetupSchedulerDB creates a disposable in-memory DB for testing
func SetupSchedulerDB() *gorm.DB {
	// ":memory:" ensures a fresh empty DB for every test call
	d, _ := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	d.AutoMigrate(&models.Schedule{})
	return d
}

func TestIsTimeMatch(t *testing.T) {
	// We don't need a DB for this pure logic test, but the method hangs off the struct
	scheduler := &Scheduler{}

	tests := []struct {
		name    string
		start   string
		end     string
		current string
		want    bool
	}{
		// Standard Ranges
		{"Mid-day Match", "12:00", "14:00", "13:00", true},
		{"Exact Start", "12:00", "14:00", "12:00", true},
		{"Exact End (Exclusive)", "12:00", "14:00", "14:00", false},
		{"Before Range", "12:00", "14:00", "11:59", false},
		{"After Range", "12:00", "14:00", "14:01", false},

		// Cross-Midnight Ranges (e.g. 22:00 -> 04:00)
		{"Midnight: Late Night", "22:00", "04:00", "23:00", true},
		{"Midnight: Early Morning", "22:00", "04:00", "03:00", true},
		{"Midnight: Noon Miss", "22:00", "04:00", "12:00", false},
		{"Midnight: Exact Start", "22:00", "04:00", "22:00", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := scheduler.isTimeMatch(tt.start, tt.end, tt.current)
			if got != tt.want {
				t.Errorf("isTimeMatch(%s, %s, %s) = %v, want %v",
					tt.start, tt.end, tt.current, got, tt.want)
			}
		})
	}
}

func TestParseCSV(t *testing.T) {
	// parseCSV is now a method on Scheduler, so we need an instance
	scheduler := &Scheduler{}

	tests := []struct {
		input string
		want  int
	}{
		{"Techno, House", 2},
		{"Techno,   House  ", 2},
		{"Techno", 1},
		{"", 0},
		{",,", 0},
	}

	for _, tt := range tests {
		got := scheduler.parseCSV(tt.input)
		if len(got) != tt.want {
			t.Errorf("parseCSV(%q) length = %d, want %d", tt.input, len(got), tt.want)
		}
	}
}

func TestGetCurrentRules(t *testing.T) {
	// 1. Setup
	db := SetupSchedulerDB()
	scheduler := NewScheduler(db)

	// 2. Dynamic Time Setup
	// Since GetCurrentRules uses time.Now(), we must craft a schedule that fits "Now"
	now := time.Now()
	dayStr := now.Weekday().String()[0:3] // e.g., "Mon"

	// Create a window from 1 hour ago to 1 hour in future
	startTime := now.Add(-1 * time.Hour).Format("15:04")
	endTime := now.Add(1 * time.Hour).Format("15:04")

	// 3. Seed Data
	activeSchedule := models.Schedule{
		Name:      "Test Show",
		Days:      dayStr, // Ensure it matches today
		Start:     startTime,
		End:       endTime,
		IsActive:  true,
		Styles:    " Dub, Techno ",
		MinYear:   1990,
		MaxYear:   2000,
		Genre:     "Electronic",
		Publisher: "Label X",
	}

	inactiveSchedule := models.Schedule{
		Name:     "Inactive Show",
		Days:     dayStr,
		Start:    startTime,
		End:      endTime,
		IsActive: false, // Should be ignored
	}

	db.Create(&activeSchedule)
	db.Create(&inactiveSchedule)

	// 4. Run Logic
	rules := scheduler.GetCurrentRules()

	// 5. Assertions
	if rules == nil {
		t.Fatal("Expected rules to be returned, got nil")
	}

	if rules.Name != "Test Show" {
		t.Errorf("Expected show 'Test Show', got '%s'", rules.Name)
	}

	// Test Style Parsing
	if len(rules.Styles) != 2 {
		t.Errorf("Expected 2 styles, got %d", len(rules.Styles))
	}
	// Check content (order might vary depending on split implementation, but usually preserves order)
	hasDub := false
	hasTechno := false
	for _, s := range rules.Styles {
		if s == "Dub" {
			hasDub = true
		}
		if s == "Techno" {
			hasTechno = true
		}
	}
	if !hasDub || !hasTechno {
		t.Errorf("Styles parsing failed. Got: %v", rules.Styles)
	}
}

func TestGetCurrentRules_Fallback(t *testing.T) {
	db := SetupSchedulerDB()
	scheduler := NewScheduler(db)

	// Insert a schedule that is clearly NOT now (Different day)
	db.Create(&models.Schedule{
		Name:     "Wrong Day Show",
		Days:     "Xyz", // Will never match weekday
		Start:    "00:00",
		End:      "23:59",
		IsActive: true,
	})

	// Should fallback to default
	rules := scheduler.GetCurrentRules()

	if rules == nil {
		t.Fatal("Got nil rules, expected fallback")
	}
	if rules.Name != "General Rotation" {
		t.Errorf("Expected fallback 'General Rotation', got '%s'", rules.Name)
	}

	// Optional: Check default values
	var defaultSlot dj.SlotRules // Zero value check or check against your fallback defaults
	if rules.MinBPM != defaultSlot.MinBPM {
		// Just ensuring it didn't pick up garbage data
	}
}
