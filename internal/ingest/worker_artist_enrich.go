package ingest

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strings"

	"github.com/hibiken/asynq"
	"gorm.io/gorm"

	"momo-radio/internal/metadata"
	"momo-radio/internal/models"
)

func (w *Worker) HandleArtistEnrichTask(ctx context.Context, t *asynq.Task) error {
	var payload localArtistEnrichPayload
	if err := json.Unmarshal(t.Payload(), &payload); err != nil {
		// If we can't parse the payload, retrying won't fix it. Skip retry.
		return fmt.Errorf("parse artist enrich payload: %w: %v", asynq.SkipRetry, err)
	}

	// 1. Fetch the artist
	var artist models.Artist
	if err := w.db.DB.WithContext(ctx).First(&artist, payload.ArtistID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			log.Printf("Artist %d not found in DB, skipping enrichment", payload.ArtistID)
			return nil
		}
		return fmt.Errorf("fetch artist %d: %w", payload.ArtistID, err)
	}

	// 2. Idempotency — already enriched?
	if artist.DiscogsID != "" {
		log.Printf("Artist %s already enriched (discogs_id=%s), skipping", artist.Name, artist.DiscogsID)
		return nil
	}

	// Sanitize the artist name using the scoring engine
	cleanSearchName := artist.Name
	if parsedArtists := NormalizeArtist(artist.Name); len(parsedArtists) > 0 {
		cleanSearchName = parsedArtists[0]
	}

	log.Printf("Background enriching Artist: '%s' (Search query: '%s')...", artist.Name, cleanSearchName)
	apiToken := w.cfg.Services.DiscogsToken

	// 3. Fetch from Discogs using the clean name
	discogsData, err := metadata.FetchArtistFromDiscogs(cleanSearchName, apiToken)
	if err != nil {
		errStr := err.Error()

		// ASYNQ RETRY LOGIC
		// If it's a rate limit, return a standard error so Asynq will retry later with backoff.
		if strings.Contains(errStr, "RATE_LIMIT_EXCEEDED") || strings.Contains(errStr, "429") {
			log.Printf("Discogs rate limit hit for artist %s. Asynq will retry later.", artist.Name)
			return fmt.Errorf("rate limited: %w", err)
		}

		// If the artist genuinely doesn't exist on Discogs, kill the job permanently.
		if strings.Contains(errStr, "no artist found") || strings.Contains(errStr, "404") {
			log.Printf("Artist '%s' not found on Discogs. Aborting future retries.", artist.Name)
			return fmt.Errorf("not found: %w", asynq.SkipRetry)
		}

		// For other random network errors, allow a retry
		return fmt.Errorf("discogs fetch failed for artist %d (%s): %w", artist.ID, artist.Name, err)
	}

	// 4. Download avatar (best-effort, doesn't fail the job if the image host is down)
	var avatarKey string
	if discogsData.ImageURL != "" && artist.AvatarURL == "" {
		key, err := w.downloadArtistAvatar(&artist, discogsData.ImageURL, apiToken)
		if err != nil {
			log.Printf("Warning: avatar download failed for artist %s: %v", artist.Name, err)
		} else {
			avatarKey = key
		}
	}

	// 5. Update DB safely in one transaction
	if err := w.db.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		updates := map[string]any{
			"discogs_id":     discogsData.ID,
			"bio":            discogsData.Profile,
			"artist_country": discogsData.Country,
		}
		if avatarKey != "" {
			updates["avatar_url"] = avatarKey
		}
		return tx.Model(&artist).Updates(updates).Error
	}); err != nil {
		return fmt.Errorf("save enriched artist %d: %w", artist.ID, err)
	}

	log.Printf("Successfully enriched artist: %s", artist.Name)
	return nil
}

// downloadArtistAvatar handles the physical image fetch and storage bucket upload
func (w *Worker) downloadArtistAvatar(artist *models.Artist, imageURL, apiToken string) (string, error) {
	imgBytes, err := metadata.DownloadImage(imageURL, apiToken)
	if err != nil {
		return "", fmt.Errorf("download: %w", err)
	}
	if len(imgBytes) == 0 {
		return "", fmt.Errorf("empty image payload returned")
	}

	avatarKey := fmt.Sprintf("organizations/%s/artists/%d_avatar.jpg", artist.OrganizationID.String(), artist.ID)

	// Wrap in a byte reader and push to S3/B2/Local
	if err := w.storage.UploadAssetFile(avatarKey, bytes.NewReader(imgBytes), "image/jpeg", "public, max-age=31536000"); err != nil {
		return "", fmt.Errorf("bucket upload: %w", err)
	}

	return avatarKey, nil
}
