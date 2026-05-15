package dj

import (
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"momo-radio/internal/models"
)

// Selector defines the common interface for any "AutoDJ" mode.
type Selector interface {
	Name() string
	PickTrack(rules *models.RuleSet, lastTrack *models.Track) (*models.Track, error)
}

// ⚡️ Added orgID parameter to the factory
func NewSelector(mode string, db *gorm.DB, orgID uuid.UUID) Selector {
	switch strings.ToLower(mode) {
	case "starvation":
		// Pass orgID into the specific selector
		return &StarvationSelector{db: db, orgID: orgID}
	default:
		// Pass orgID into the specific selector
		return &RandomSelector{db: db, orgID: orgID}
	}
}

// ⚡️ Forcefully accept orgID so NO query can ever escape the tenant's library!
func applyBaseFilters(db *gorm.DB, rules *models.RuleSet, orgID uuid.UUID) *gorm.DB {
	// 1. ⚡️ THE LOCK: Always restrict to the specific organization first!
	db = db.Where("organization_id = ?", orgID)

	if rules == nil {
		return db
	}

	// 2. Filter by Genre
	if rules.Genre != "" {
		db = db.Where("genre = ?", rules.Genre)
	}

	// 3. Filter by BPM Range
	if rules.MinBPM > 0 {
		db = db.Where("bpm >= ?", rules.MinBPM)
	}
	if rules.MaxBPM > 0 {
		db = db.Where("bpm <= ?", rules.MaxBPM)
	}

	// 4. Filter by Release Year
	if rules.MinYear > 0 {
		db = db.Where("year >= ?", rules.MinYear)
	}

	// 5. Global Anti-Repetition
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
