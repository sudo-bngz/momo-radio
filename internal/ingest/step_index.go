package ingest

import (
	"fmt"

	"github.com/meilisearch/meilisearch-go"
)

type IndexStep struct{}

func (s *IndexStep) Name() string { return "indexing_search" }

func (s *IndexStep) Execute(ctx *ProcessingContext) error {
	if ctx.Track == nil {
		return fmt.Errorf("track context missing before indexing")
	}

	// 1. Extract pure artist name strings
	var artistNames []string
	for _, a := range ctx.Track.Artists {
		if a.Name != "" {
			artistNames = append(artistNames, a.Name)
		}
	}

	// 2. Extract album title and cover safely
	albumTitle := ""
	coverStr := ""
	if ctx.Track.Album.Title != "" {
		albumTitle = ctx.Track.Album.Title
		coverStr = ctx.Track.Album.CoverKey
	}

	// 3. Fallback to primary artist avatar if the album has no cover
	if coverStr == "" && len(ctx.Track.Artists) > 0 {
		coverStr = ctx.Track.Artists[0].AvatarURL
	}

	// 4. Build the flat document
	doc := map[string]any{
		"id":                 fmt.Sprintf("track-%d", ctx.Track.ID),
		"organization_id":    ctx.Track.OrganizationID.String(),
		"title":              ctx.Track.Title,
		"artists_names":      artistNames,
		"album_title":        albumTitle,
		"genre":              ctx.Track.Genre,
		"style":              ctx.Track.Style,
		"mood":               ctx.Track.Mood,
		"scale":              ctx.Track.Scale,
		"musical_key":        ctx.Track.MusicalKey,
		"bpm":                ctx.Track.BPM,
		"ml_characteristics": []string(ctx.Track.MLCharacteristics),
		"duration":           ctx.Track.Duration,
		"cover_url":          coverStr,
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
