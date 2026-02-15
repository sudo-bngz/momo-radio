package dj

import (
	"momo-radio/internal/models"

	"gorm.io/gorm"
)

type RandomSelector struct {
	db *gorm.DB
}

func (s *RandomSelector) Name() string { return "Random" }

func (s *RandomSelector) PickTrack(rules *models.RuleSet, _ *models.Track) (*models.Track, error) {
	var track models.Track
	query := s.db.Model(&models.Track{})
	query = applyBaseFilters(query, rules)

	err := query.Order("RANDOM()").First(&track).Error
	return &track, err
}
