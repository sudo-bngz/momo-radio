package dj

import (
	"testing"
	"time"

	database "momo-radio/internal/db"
	"momo-radio/internal/models"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// Helper to create a disposable in-memory DB
func SetupSchedulerDB() *database.Client {
	// FIX: Use ":memory:" instead of "file::memory:?cache=shared"
	// This ensures every time this function is called, we get a brand new, empty DB.
	d, _ := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	d.AutoMigrate(&models.Schedule{})
	return &database.Client{DB: d}
}

func TestIsTimeMatch(t *testing.T) {
	db := SetupSchedulerDB()
	scheduler := NewScheduler(db)

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

func TestGetCurrentCriteria(t *testing.T) {
	// 1. Setup
	mockDB := SetupSchedulerDB()
	scheduler := NewScheduler(mockDB)

	// 2. Determine "Now" so we can insert a matching schedule
	now := time.Now()
	dayStr := now.Weekday().String()[0:3] // e.g., "Tue"

	// Create a time window that definitely includes "now"
	// Start: 1 minute ago, End: 1 hour from now
	startTime := now.Add(-1 * time.Minute).Format("15:04")
	endTime := now.Add(1 * time.Hour).Format("15:04")

	// 3. Insert Test Data
	activeSchedule := models.Schedule{
		Name:     "Test Show",
		Days:     dayStr, // e.g. "Mon,Tue,Wed"
		Start:    startTime,
		End:      endTime,
		IsActive: true,
		Styles:   " Dub, Techno ", // Test trimming
		Artists:  "Basic Channel, Deepchord",
		MinYear:  1990,
		MaxYear:  2000,
	}

	inactiveSchedule := models.Schedule{
		Name:     "Inactive Show",
		Days:     dayStr,
		Start:    startTime,
		End:      endTime,
		IsActive: false, // Should be ignored
	}

	mockDB.DB.Create(&activeSchedule)
	mockDB.DB.Create(&inactiveSchedule)

	// 4. Run Logic
	criteria := scheduler.GetCurrentCriteria()

	// 5. Assertions
	if criteria == nil {
		t.Fatal("Expected criteria to be returned, got nil")
	}

	if criteria.Name != "Test Show" {
		t.Errorf("Expected show 'Test Show', got '%s'", criteria.Name)
	}

	// Test Style Parsing (Comma split + Trim)
	if len(criteria.Styles) != 2 {
		t.Errorf("Expected 2 styles, got %d", len(criteria.Styles))
	}
	if criteria.Styles[0] != "Dub" || criteria.Styles[1] != "Techno" {
		t.Errorf("Styles parsing failed. Got: %v", criteria.Styles)
	}

	// Test Artist Parsing
	if len(criteria.Artists) != 2 {
		t.Errorf("Expected 2 artists, got %d", len(criteria.Artists))
	}
	if criteria.Artists[0] != "Basic Channel" {
		t.Errorf("Artist parsing failed. Got: %v", criteria.Artists)
	}
}

func TestGetCurrentCriteria_NoMatch(t *testing.T) {
	mockDB := SetupSchedulerDB()
	scheduler := NewScheduler(mockDB)

	// Insert a schedule that is clearly NOT now (e.g. valid yesterday)
	// We use a dummy day "Xyz" that will never match time.Weekday()
	mockDB.DB.Create(&models.Schedule{
		Name:     "Wrong Day Show",
		Days:     "Xyz",
		Start:    "00:00",
		End:      "23:59",
		IsActive: true,
	})

	criteria := scheduler.GetCurrentCriteria()

	if criteria != nil {
		t.Errorf("Expected nil criteria for no match, got: %v", criteria)
	}
}
