package dj

import (
	"momo-radio/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type RandomSelector struct {
	db    *gorm.DB
	orgID uuid.UUID
}

func (s *RandomSelector) Name() string { return "Random" }

func (s *RandomSelector) PickTrack(rules *models.RuleSet, _ *models.Track) (*models.Track, error) {
	var track models.Track
	query := s.db.Model(&models.Track{})
	query = applyBaseFilters(query, rules, s.orgID)

	err := query.Order("RANDOM()").First(&track).Error
	return &track, err
}
