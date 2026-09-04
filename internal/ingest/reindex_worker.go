package ingest

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/hibiken/asynq"
	"github.com/meilisearch/meilisearch-go"
	"go.uber.org/zap"
	"gorm.io/gorm"

	"momo-radio/internal/logger"
	"momo-radio/internal/models"
)

// Define the task type constant
const TypeReindexCatalog = "search:reindex_catalog"

// Payload for the task
type ReindexCatalogPayload struct {
	OrganizationID string `json:"organization_id"`
}

// ⚡️ ADDED: splitTags helper moved here from index_step.go
// splitTags takes a comma-separated string, splits it, trims spaces, and returns a clean slice
func splitTags(input string) []string {
	if input == "" {
		return []string{} // Return an empty array instead of nil so Meilisearch indexes it cleanly
	}

	rawTags := strings.Split(input, ",")
	var cleanTags []string

	for _, tag := range rawTags {
		trimmed := strings.TrimSpace(tag)
		if trimmed != "" {
			cleanTags = append(cleanTags, trimmed)
		}
	}

	return cleanTags
}

func MapTrackToMeiliDoc(track *models.Track) map[string]any {
	var artistNames []string
	for _, artist := range track.Artists {
		if artist.Name != "" {
			artistNames = append(artistNames, artist.Name)
		}
	}

	albumTitle := ""
	coverKey := ""

	// Safely check if the Album struct actually has data
	if track.Album.Title != "" {
		albumTitle = track.Album.Title
		coverKey = track.Album.CoverKey
	}

	// Fallback to primary artist avatar if the album has no cover
	if coverKey == "" && len(track.Artists) > 0 {
		coverKey = track.Artists[0].AvatarURL
	}

	return map[string]any{
		"id":              fmt.Sprintf("track-%d", track.ID),
		"organization_id": track.OrganizationID.String(),
		"title":           track.Title,
		"artists_names":   artistNames,
		"album_title":     albumTitle,
		"cover_url":       coverKey,

		// Map our arrays using the splitTags helper
		"genre":       splitTags(track.Genre),
		"style":       splitTags(track.Style),
		"mood":        splitTags(track.Mood),
		"scale":       splitTags(track.Scale),
		"musical_key": splitTags(track.MusicalKey),

		"bpm":                track.BPM,
		"ml_characteristics": []string(track.MLCharacteristics),
		"duration":           track.Duration,
	}
}

// The actual background job handler
func (w *Worker) HandleReindexCatalogTask(ctx context.Context, t *asynq.Task) error {
	var payload ReindexCatalogPayload
	if err := json.Unmarshal(t.Payload(), &payload); err != nil {
		return fmt.Errorf("json.Unmarshal failed: %v", err)
	}

	logger.Log.Info("Starting Meilisearch reindex job", zap.String("org_id", payload.OrganizationID))

	// Reference the correct models.Track array
	var tracks []models.Track
	batchSize := 500
	totalProcessed := 0
	pk := "id"

	// Fetch tracks in batches of 500 to save memory and avoid spiking RAM
	err := w.db.DB.Where("organization_id = ?", payload.OrganizationID).
		Preload("Artists").
		Preload("Album").
		FindInBatches(&tracks, batchSize, func(tx *gorm.DB, batch int) error {

			var docs []map[string]any
			for i := range tracks {
				docs = append(docs, MapTrackToMeiliDoc(&tracks[i]))
			}

			// Push batch to Meilisearch using AddDocuments (upsert by primary key)
			_, err := w.meili.Index("tracks").AddDocuments(docs, &meilisearch.DocumentOptions{
				PrimaryKey: &pk,
			})
			if err != nil {
				return err
			}

			totalProcessed += len(docs)
			logger.Log.Info("Reindex batch completed", zap.Int("batch", batch), zap.Int("processed_so_far", totalProcessed))
			return nil
		}).Error

	if err != nil {
		logger.Log.Error("Reindex job failed", zap.Error(err), zap.String("org_id", payload.OrganizationID))
		return err
	}

	logger.Log.Info("Meilisearch reindex job finished successfully", zap.Int("total_tracks", totalProcessed))
	return nil
}
