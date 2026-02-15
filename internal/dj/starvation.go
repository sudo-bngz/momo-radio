package dj

import (
	"errors"
	"math/rand"
	"momo-radio/internal/models"

	"gorm.io/gorm"
)

type StarvationSelector struct {
	db *gorm.DB
}

func (s *StarvationSelector) Name() string { return "Starvation" }

func (s *StarvationSelector) PickTrack(rules *models.RuleSet, _ *models.Track) (*models.Track, error) {
	var candidates []models.Track

	query := s.db.Model(&models.Track{})
	query = applyBaseFilters(query, rules)

	// Sort by oldest played first.
	// We grab 20 to pick one randomly so the station doesn't feel like a loop.
	err := query.Order("last_played_at ASC NULLS FIRST").Limit(20).Find(&candidates).Error
	if err != nil || len(candidates) == 0 {
		return nil, errors.New("starvation: no tracks found")
	}

	return &candidates[rand.Intn(len(candidates))], nil
}
