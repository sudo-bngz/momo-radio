package ingest

import (
	"fmt"

	"github.com/meilisearch/meilisearch-go"
	"go.uber.org/zap"

	"momo-radio/internal/logger"
)

type IndexStep struct{}

func (s *IndexStep) Name() string { return "indexing_search" }

func (s *IndexStep) Execute(ctx *ProcessingContext) error {
	if ctx.Track == nil {
		logger.Log.Error("Track context missing before indexing")
		return fmt.Errorf("track context missing before indexing")
	}

	logger.Log.Debug("Preparing track document for Meilisearch", zap.Any("track_id", ctx.Track.ID))

	doc := MapTrackToMeiliDoc(ctx.Track)

	pk := "id"
	_, err := ctx.Worker.meili.Index("tracks").AddDocuments([]map[string]any{doc}, &meilisearch.DocumentOptions{
		PrimaryKey: &pk,
	})

	if err != nil {
		logger.Log.Error("Failed to push track to Meilisearch",
			zap.Any("track_id", ctx.Track.ID),
			zap.Error(err),
		)
		return fmt.Errorf("failed to push track to meilisearch: %w", err)
	}

	logger.Log.Info("Successfully indexed track in Meilisearch",
		zap.Any("track_id", ctx.Track.ID),
	)

	return nil
}
