package ingest

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"

	"momo-radio/internal/metadata"
	"momo-radio/internal/models"

	"github.com/hibiken/asynq"
)

// HandleArtistEnrichTask processes the background job to fetch artist data
func (w *Worker) HandleArtistEnrichTask(ctx context.Context, t *asynq.Task) error {
	var payload ArtistEnrichPayload
	if err := json.Unmarshal(t.Payload(), &payload); err != nil {
		return fmt.Errorf("failed to parse artist enrich payload: %v", err)
	}

	// 1. Fetch the Artist from DB
	var artist models.Artist
	if err := w.db.DB.First(&artist, payload.ArtistID).Error; err != nil {
		return fmt.Errorf("artist not found: %w", err)
	}

	if artist.DiscogsID != "" {
		log.Printf("Artist %s already enriched. Skipping.", artist.Name)
		return nil
	}

	log.Printf("Enriching Artist: %s...", artist.Name)
	apiToken := w.cfg.Services.DiscogsToken

	// 2. Fetch Metadata from Discogs
	discogsData, err := metadata.FetchArtistFromDiscogs(artist.Name, apiToken)
	if err != nil {
		return fmt.Errorf("discogs fetch failed for %s: %w", artist.Name, err)
	}

	// 3. DOWNLOAD AND STORE THE IMAGE
	var avatarKey string
	if discogsData.ImageURL != "" {
		imgBytes, err := metadata.DownloadImage(discogsData.ImageURL, apiToken)
		if err != nil {
			log.Printf("Warning: failed to download image for artist %s: %v", artist.Name, err)
		} else {
			// Generate S3 Key
			avatarKey = fmt.Sprintf("organizations/%s/artists/%d_avatar.jpg", artist.OrganizationID.String(), artist.ID)

			// Wrap the bytes in a Reader so your Storage Provider accepts it
			reader := bytes.NewReader(imgBytes)

			// Upload as a public asset with 1-year cache control
			err = w.storage.UploadAssetFile(avatarKey, reader, "image/jpeg", "max-age=31536000")
			if err != nil {
				log.Printf("Warning: failed to upload image to bucket for artist %s: %v", artist.Name, err)
				avatarKey = ""
			} else {
				log.Printf("Successfully saved artist avatar to bucket: %s", avatarKey)
			}
		}
	}

	// 4. Update the database
	updates := map[string]interface{}{
		"discogs_id":     discogsData.ID,
		"bio":            discogsData.Profile,
		"artist_country": discogsData.Country,
	}

	if avatarKey != "" {
		updates["avatar_url"] = avatarKey
	}

	if err := w.db.DB.Model(&artist).Updates(updates).Error; err != nil {
		return fmt.Errorf("failed to save enriched artist data: %w", err)
	}

	log.Printf("Successfully enriched artist: %s", artist.Name)
	return nil
}
