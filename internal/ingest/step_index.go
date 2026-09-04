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

	doc := MapTrackToMeiliDoc(ctx.Track)

	pk := "id"
	_, err := ctx.Worker.meili.Index("tracks").AddDocuments([]map[string]any{doc}, &meilisearch.DocumentOptions{
		PrimaryKey: &pk,
	})

	if err != nil {
		return fmt.Errorf("failed to push track to meilisearch: %w", err)
	}

	return nil
}
