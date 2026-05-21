package ingest

import (
	"log"
	"strings"

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
		log.Fatalf("Failed to fetch artists: %v", err)
	}

	if len(artists) == 0 {
		log.Println("No artists found needing country repair.")
		return
	}

	log.Printf("Starting Country Repair for %d artists using %s...", len(artists), provider)

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
			log.Printf("Could not find country for %s: %v", artist.Name, err)
			continue
		}

		if dryRun {
			log.Printf("[DRY RUN] Would update %s -> Country: %s", artist.Name, newCountry)
			continue
		}

		// Update Database
		if err := w.db.DB.Model(&artist).Update("artist_country", newCountry).Error; err != nil {
			log.Printf("Failed to update database for %s: %v", artist.Name, err)
		} else {
			log.Printf("Successfully updated %s -> Country: %s", artist.Name, newCountry)
		}
	}

	log.Println("Country repair complete.")
}
