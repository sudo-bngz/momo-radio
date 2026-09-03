package ingest

import (
	"fmt"
	"strings"

	"github.com/meilisearch/meilisearch-go"
)

type IndexStep struct{}

func (s *IndexStep) Name() string { return "indexing_search" }

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

func (s *IndexStep) Execute(ctx *ProcessingContext) error {
	if ctx.Track == nil {
		return fmt.Errorf("track context missing before indexing")
	}

	var artistNames []string
	for _, artist := range ctx.Track.Artists {
		if artist.Name != "" {
			artistNames = append(artistNames, artist.Name)
		}
	}

	albumTitle := ""
	coverKey := ""

	// Safely check if the Album struct actually has data
	if ctx.Track.Album.Title != "" {
		albumTitle = ctx.Track.Album.Title
		coverKey = ctx.Track.Album.CoverKey
	}

	// Fallback to primary artist avatar if the album has no cover
	if coverKey == "" && len(ctx.Track.Artists) > 0 {
		coverKey = ctx.Track.Artists[0].AvatarURL
	}

	doc := map[string]any{
		"id":              fmt.Sprintf("track-%d", ctx.Track.ID),
		"organization_id": ctx.Track.OrganizationID.String(),
		"title":           ctx.Track.Title,

		"artists_names": artistNames,
		"album_title":   albumTitle,
		"cover_url":     coverKey,

		"genre":       splitTags(ctx.Track.Genre),
		"style":       splitTags(ctx.Track.Style),
		"mood":        splitTags(ctx.Track.Mood),
		"scale":       splitTags(ctx.Track.Scale),
		"musical_key": splitTags(ctx.Track.MusicalKey),

		"bpm":                ctx.Track.BPM,
		"ml_characteristics": []string(ctx.Track.MLCharacteristics),
		"duration":           ctx.Track.Duration,
	}

	pk := "id"
	_, err := ctx.Worker.meili.Index("tracks").AddDocuments([]map[string]any{doc}, &meilisearch.DocumentOptions{
		PrimaryKey: &pk,
	})

	if err != nil {
		return fmt.Errorf("failed to push track to meilisearch: %w", err)
	}

	return nil
}
