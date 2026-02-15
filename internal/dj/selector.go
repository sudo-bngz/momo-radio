package dj

import (
	"strings"
	"time"

	"momo-radio/internal/models"

	"gorm.io/gorm"
)

// Selector defines the common interface for any "AutoDJ" mode.
type Selector interface {
	Name() string
	PickTrack(rules *models.RuleSet, lastTrack *models.Track) (*models.Track, error)
}

// NewSelector is a factory that returns the requested algorithm.
func NewSelector(mode string, db *gorm.DB) Selector {
	switch strings.ToLower(mode) {
	case "starvation":
		return &StarvationSelector{db: db}
	default:
		return &RandomSelector{db: db}
	}
}

// applyBaseFilters handles common constraints like Genre, BPM, and Year.
// It is lowercase, meaning it is "private" to the dj package.
func applyBaseFilters(db *gorm.DB, rules *models.RuleSet) *gorm.DB {
	if rules == nil {
		return db
	}

	// 1. Filter by Genre
	if rules.Genre != "" {
		db = db.Where("genre = ?", rules.Genre)
	}

	// 2. Filter by BPM Range
	if rules.MinBPM > 0 {
		db = db.Where("bpm >= ?", rules.MinBPM)
	}
	if rules.MaxBPM > 0 {
		db = db.Where("bpm <= ?", rules.MaxBPM)
	}

	// 3. Filter by Release Year
	if rules.MinYear > 0 {
		db = db.Where("year >= ?", rules.MinYear)
	}

	// 4. Global Anti-Repetition
	// Prevents the same track from playing twice within 2 hours.
	twoHoursAgo := time.Now().Add(-2 * time.Hour)
	db = db.Where("last_played_at IS NULL OR last_played_at < ?", twoHoursAgo)

	return db
}

// parseCSV helper to split the styles string (used by specific selectors)
func parseCSV(input string) []string {
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
