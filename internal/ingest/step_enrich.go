package ingest

import (
	"encoding/json"
	"log"

	"github.com/hibiken/asynq"
)

type EnrichStep struct{}

func (s *EnrichStep) Name() string {
	return "enriching_metadata"
}

func (s *EnrichStep) Execute(ctx *ProcessingContext) error {
	// If for some reason the track or artists weren't loaded by DatabaseSaveStep, safely skip.
	if ctx.Track == nil || len(ctx.Track.Artists) == 0 {
		return nil
	}

	for _, artist := range ctx.Track.Artists {
		payload, err := json.Marshal(ArtistEnrichPayload{ArtistID: artist.ID})
		if err != nil {
			log.Printf("Warning: Failed to marshal artist enrich payload for ID %d: %v", artist.ID, err)
			continue
		}

		// Create the Asynq task
		task := asynq.NewTask(TypeArtistEnrich, payload)

		// We deliberately ignore the error (just log it) because we do not
		// want to fail the entire audio ingest pipeline if Redis is briefly busy.
		_, err = ctx.Worker.asynqClient.Enqueue(task)

		if err != nil {
			log.Printf("Warning: Failed to enqueue enrichment task for artist %d: %v", artist.ID, err)
		} else {
			log.Printf("Enqueued background enrichment task for artist: %s (ID: %d)", artist.Name, artist.ID)
		}
	}

	// Always return success to the ingest pipeline orchestrator
	return nil
}
