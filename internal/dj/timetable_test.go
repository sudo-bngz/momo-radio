package dj

import (
	"os"
	"strings"
	"testing"
	"time"
)

// Helper to create a temporary YAML file for testing
func createTempConfig(t *testing.T, content string) string {
	tmpfile, err := os.CreateTemp("", "timetable_*.yaml")
	if err != nil {
		t.Fatalf("Failed to create temp file: %v", err)
	}
	if _, err := tmpfile.Write([]byte(content)); err != nil {
		t.Fatalf("Failed to write to temp file: %v", err)
	}
	if err := tmpfile.Close(); err != nil {
		t.Fatalf("Failed to close temp file: %v", err)
	}
	return tmpfile.Name()
}

func TestLoadTimetable_Errors(t *testing.T) {
	// Case 1: File does not exist
	err := LoadTimetable("non_existent_file.yaml")
	if err == nil {
		t.Error("Expected error for non-existent file, got nil")
	}

	// Case 2: Invalid YAML syntax
	badYamlPath := createTempConfig(t, "this: is: invalid: yaml: [")
	defer os.Remove(badYamlPath)

	err = LoadTimetable(badYamlPath)
	if err == nil {
		t.Error("Expected error for invalid YAML, got nil")
	} else if !strings.Contains(err.Error(), "yaml") {
		// Just checking if it's actually a yaml error
		t.Logf("Got expected YAML error: %v", err)
	}
}

func TestGetCurrentSlot(t *testing.T) {
	// 1. Define a test schedule
	// Monday: 06-12 (Morning), 12-18 (Afternoon)
	// Defaults: "Global Default"
	yamlContent := `
defaults:
  name: "Global Default"
  styles: ["Pop"]
  min_bpm: 100
  max_bpm: 120

timetable:
  monday:
    - start_hour: 6
      end_hour: 12
      name: "Morning Show"
      styles: ["Dub"]
      min_bpm: 80
      max_bpm: 100
    - start_hour: 12
      end_hour: 18
      name: "Afternoon Show"
      styles: ["House"]
      min_bpm: 120
      max_bpm: 130
`
	// 2. Setup
	configPath := createTempConfig(t, yamlContent)
	defer os.Remove(configPath)

	if err := LoadTimetable(configPath); err != nil {
		t.Fatalf("Failed to load valid test config: %v", err)
	}

	// 3. Helper to construct a Time object for a specific Day/Hour
	getTestTime := func(weekday time.Weekday, hour int) time.Time {
		// Pick a known anchor date (Jan 1 2024 was a Monday)
		// We calculate the offset to get the desired Weekday
		base := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
		daysToAdd := int(weekday) - int(base.Weekday())

		// Set the exact hour we want to test
		return base.AddDate(0, 0, daysToAdd).Add(time.Duration(hour) * time.Hour)
	}

	// 4. Test Cases
	tests := []struct {
		name     string
		time     time.Time
		wantName string
		wantBPM  float64
	}{
		{
			name:     "Monday Morning Match (08:00)",
			time:     getTestTime(time.Monday, 8),
			wantName: "Morning Show",
			wantBPM:  80,
		},
		{
			name:     "Monday Afternoon Start Boundary (12:00)",
			time:     getTestTime(time.Monday, 12),
			wantName: "Afternoon Show",
			wantBPM:  120, // Should switch exactly at 12
		},
		{
			name:     "Monday Night Gap -> Default (20:00)",
			time:     getTestTime(time.Monday, 20),
			wantName: "Global Default", // No rule for 20:00, fallback to defaults
			wantBPM:  100,
		},
		{
			name:     "Tuesday (No Rules) -> Default (10:00)",
			time:     getTestTime(time.Tuesday, 10),
			wantName: "Global Default", // No entry for Tuesday
			wantBPM:  100,
		},
	}

	// 5. Execution
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := GetCurrentSlot(tt.time)

			if got.Name != tt.wantName {
				t.Errorf("Name mismatch! Got %q, want %q", got.Name, tt.wantName)
			}
			if got.MinBPM != tt.wantBPM {
				t.Errorf("BPM mismatch! Got %f, want %f", got.MinBPM, tt.wantBPM)
			}
		})
	}
}

func TestUninitializedConfig(t *testing.T) {
	// Reset the global config to nil to simulate "server just started, file not loaded"
	timetableMu.Lock()
	currentConfig = nil
	timetableMu.Unlock()

	// Should return the hardcoded safe fallback
	got := GetCurrentSlot(time.Now())

	if got.Name != "General Rotation" {
		t.Errorf("Expected hardcoded fallback 'General Rotation', got %q", got.Name)
	}
}
