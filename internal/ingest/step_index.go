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

	doc := map[string]any{
		"id":                 fmt.Sprintf("track-%d", ctx.Track.ID),
		"organization_id":    ctx.Track.OrganizationID.String(),
		"title":              ctx.Track.Title,
		"artists_names":      ctx.Track.Artists,
		"album_title":        ctx.Track.Album,
		"genre":              ctx.Track.Genre,
		"style":              ctx.Track.Style,
		"mood":               ctx.Track.Mood,
		"scale":              ctx.Track.Scale,
		"musical_key":        ctx.Track.MusicalKey,
		"bpm":                ctx.Track.BPM,
		"ml_characteristics": ctx.Track.MLCharacteristics,
		"duration":           ctx.Track.Duration,
		"cover_url":          ctx.Track.Album.CoverKey,
	}

	pk := "id"

	_, err := ctx.Worker.meili.Index("tracks").AddDocuments([]map[string]any{doc}, &meilisearch.DocumentOptions{
		PrimaryKey: &pk,
	})

	if err != nil {
		return fmt.Errorf("failed to push track to meilisearch: %w", err)
	}

	return err
}
