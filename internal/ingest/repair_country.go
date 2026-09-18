package ingest

import (
	"strings"

	"go.uber.org/zap"

	"momo-radio/internal/logger"
	"momo-radio/internal/metadata"
	"momo-radio/internal/models"
)

// RepairCountry targets artists missing country data and attempts to enrich them.
func (w *Worker) RepairCountry(dryRun bool, targetArtists []string, provider string) {
	var artists []models.Artist
	query := w.db.DB

	// If specific artists were provided via CLI flag (-artists="Regal,Daft Punk")
	if len(targetArtists) > 0 {
		query = query.Where("name IN ?", targetArtists)
	} else {
		// Otherwise, find all artists missing country data
		query = query.Where("artist_country = '' OR artist_country IS NULL")
	}

	if err := query.Find(&artists).Error; err != nil {
		logger.Log.Fatal("Failed to fetch artists", zap.Error(err))
	}

	if len(artists) == 0 {
		logger.Log.Info("No artists found needing country repair.")
		return
	}

	logger.Log.Info("Starting Country Repair",
		zap.Int("artist_count", len(artists)),
		zap.String("provider", provider),
	)

	for _, artist := range artists {
		var newCountry string
		var err error

		if strings.ToLower(provider) == "discogs" {
			newCountry, err = metadata.GetArtistCountryViaDiscogs(artist.Name, w.cfg.Services.DiscogsToken)
		} else {
			// In a full implementation, you could add a MusicBrainz country fetcher here.
			// We will fallback to Discogs for now.
			newCountry, err = metadata.GetArtistCountryViaDiscogs(artist.Name, w.cfg.Services.DiscogsToken)
		}

		if err != nil || newCountry == "" {
			logger.Log.Warn("Could not find country for artist",
				zap.String("artist", artist.Name),
				zap.Error(err),
			)
			continue
		}

		if dryRun {
			logger.Log.Info("[DRY RUN] Would update artist country",
				zap.String("artist", artist.Name),
				zap.String("new_country", newCountry),
			)
			continue
		}

		// Update Database
		if err := w.db.DB.Model(&artist).Update("artist_country", newCountry).Error; err != nil {
			logger.Log.Error("Failed to update database for artist",
				zap.String("artist", artist.Name),
				zap.Error(err),
			)
		} else {
			logger.Log.Info("Successfully updated artist country",
				zap.String("artist", artist.Name),
				zap.String("new_country", newCountry),
			)
		}
	}

	logger.Log.Info("Country repair complete.")
}
