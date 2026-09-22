package dj

import (
	"go.uber.org/zap"
	"gorm.io/gorm"

	"github.com/google/uuid"

	"momo-radio/internal/logger"
	"momo-radio/internal/models"
)

type RandomSelector struct {
	db    *gorm.DB
	orgID uuid.UUID
}

func (s *RandomSelector) Name() string { return "Random" }

func (s *RandomSelector) PickTrack(rules *models.RuleSet, _ *models.Track) (*models.Track, error) {
	logger.Log.Debug("Executing random track selection", zap.String("org_id", s.orgID.String()))

	var tracks []models.Track
	query := s.db.Model(&models.Track{})
	query = applyBaseFilters(query, rules, s.orgID)

	err := query.Order("RANDOM()").Limit(1).Find(&tracks).Error
	if err != nil {
		logger.Log.Error("Database error during random track selection",
			zap.String("org_id", s.orgID.String()),
			zap.Error(err),
		)
		return nil, err
	}

	if len(tracks) == 0 {
		logger.Log.Debug("No tracks available matching AutoDJ criteria", zap.String("org_id", s.orgID.String()))
		return nil, nil
	}

	track := tracks[0]

	logger.Log.Debug("Random track successfully selected",
		zap.Any("track_id", track.ID),
		zap.String("org_id", s.orgID.String()),
	)

	return &track, nil
}
