package dj

import (
	"fmt"
	database "momo-radio/internal/db"
	"momo-radio/internal/models"
	"testing"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// SetupInMemoryDB creates a throwaway DB for testing
func SetupInMemoryDB() *database.Client {
	// "file::memory:?cache=shared" creates a pure RAM database
	d, _ := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	d.AutoMigrate(&models.Track{}, &models.PlayHistory{})
	return &database.Client{DB: d}
}

func TestBuildHarmonicSet(t *testing.T) {
	// 1. Setup DB
	mockDB := SetupInMemoryDB()

	// 2. Seed Data
	var tracks []models.Track

	// Seed 15 "Techno" tracks to pass the "minimum 10 tracks" safety check
	for i := 0; i < 15; i++ {
		tracks = append(tracks, models.Track{
			Key:        fmt.Sprintf("music/techno_%d.mp3", i),
			BPM:        130,
			Genre:      "Techno",
			MusicalKey: "C",
			Scale:      "major",
			PlayCount:  0,
		})
	}

	// Add 1 "Ambient" track (The intruder we want to filter out)
	tracks = append(tracks, models.Track{
		Key:        "music/ambient.mp3",
		BPM:        90,
		Genre:      "Ambient",
		MusicalKey: "A",
		Scale:      "minor",
		PlayCount:  0,
	})

	mockDB.DB.Create(&tracks)

	// 3. Create Deck
	deck := NewDeck(nil, mockDB, "music/")

	// 4. Test Case: "Techno Hour"
	rules := SlotRules{
		Name:   "Techno Hour",
		Styles: []string{"Techno"},
		MinBPM: 120,
		MaxBPM: 140,
	}

	// 5. Run Logic
	err := deck.buildHarmonicSet(rules)
	if err != nil {
		t.Fatalf("buildHarmonicSet failed: %v", err)
	}

	// 6. Assertions
	if len(deck.queue) == 0 {
		t.Fatal("Queue should not be empty")
	}

	// Check if we got the right songs
	ambientFound := false
	for _, key := range deck.queue {
		if key == "music/ambient.mp3" {
			ambientFound = true
		}
	}

	if ambientFound {
		t.Error("❌ Filter Failed: Found Ambient track in Techno set (Did fallback trigger?)")
	} else {
		t.Logf("✅ Success: %d tracks generated, Ambient excluded.", len(deck.queue))
	}
}

func TestFallbackStrategy(t *testing.T) {
	mockDB := SetupInMemoryDB()

	// Only seed 5 Ambient tracks (Less than the 10 threshold)
	// This forces the fallback to trigger even if we ask for Techno
	var tracks []models.Track
	for i := 0; i < 5; i++ {
		tracks = append(tracks, models.Track{
			Key:   fmt.Sprintf("music/amb_%d.mp3", i),
			BPM:   80,
			Genre: "Ambient",
		})
	}
	mockDB.DB.Create(&tracks)

	deck := NewDeck(nil, mockDB, "music/")

	// Ask for "Techno" (which doesn't exist)
	rules := SlotRules{
		Name:   "Impossible Techno",
		Styles: []string{"Hard Techno"},
		MinBPM: 140,
	}

	deck.buildHarmonicSet(rules)

	// Should fall back and load the Ambient tracks anyway
	if len(deck.queue) == 0 {
		t.Error("Fallback failed: Queue is empty despite tracks existing in DB")
	} else {
		t.Logf("✅ Fallback worked: Loaded %d tracks (Expected Ambient)", len(deck.queue))
	}
}
