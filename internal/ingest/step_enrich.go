package ingest

import (
	"encoding/json"

	"github.com/hibiken/asynq"
	"go.uber.org/zap"

	"momo-radio/internal/logger"
	"momo-radio/internal/models"
)

// -----------------------------------------------------------------------------
// ENRICHMENT QUEUE STEP
// -----------------------------------------------------------------------------

// We define the payloads here locally for clarity, ensuring they match worker.go
type localArtistEnrichPayload struct {
	ArtistID uint `json:"artist_id"`
}

type localTrackEnrichPayload struct {
	TrackID       uint   `json:"track_id"`
	ArtistName    string `json:"artist_name"`
	TrackTitle    string `json:"track_title"`
	MusicBrainzID string `json:"musicbrainz_id"`
}

type EnrichStep struct{}

func (s *EnrichStep) Name() string { return "queueing_enrichment" }

func (s *EnrichStep) Execute(ctx *ProcessingContext) error {
	// If the user hasn't configured Discogs, bypass enrichment entirely
	if ctx.Worker.cfg.Services.DiscogsToken == "" {
		return nil
	}

	// ⚡️ THE FIX: Explicitly load the newly saved Artists from the DB!
	// This prevents the in-memory race condition where GORM Association hasn't updated the slice.
	var dbArtists []models.Artist
	if err := ctx.Worker.db.DB.Model(ctx.Track).Association("Artists").Find(&dbArtists); err == nil {
		ctx.Track.Artists = dbArtists
	} else {
		logger.Log.Warn("Could not fetch artists for enrichment queue",
			zap.Any("track_id", ctx.Track.ID),
			zap.Error(err),
		)
	}

	// 1. Queue ARTIST Enrichment
	for _, artist := range ctx.Track.Artists {
		// Only queue if we haven't already enriched them
		if artist.DiscogsID == "" {
			payload := ArtistEnrichPayload{ArtistID: artist.ID} // Uses the struct from worker.go
			payloadBytes, _ := json.Marshal(payload)

			task := asynq.NewTask(TypeArtistEnrich, payloadBytes)
			if _, err := ctx.Worker.asynqClient.Enqueue(task); err != nil {
				logger.Log.Warn("Failed to enqueue artist enrichment",
					zap.String("artist", artist.Name),
					zap.Error(err),
				)
			} else {
				logger.Log.Info("Enqueued background enrichment task for artist",
					zap.String("artist", artist.Name),
					zap.Any("artist_id", artist.ID),
				)
			}
		}
	}

	// Get the safest local Artist name (fallback to Unknown if somehow empty)
	artistName := "Unknown"
	if len(ctx.Meta.Artists) > 0 {
		artistName = ctx.Meta.Artists[0]
	} else if len(ctx.Track.Artists) > 0 {
		artistName = ctx.Track.Artists[0].Name
	}

	// 2. Queue TRACK/RELEASE Enrichment
	trackPayload := TrackEnrichPayload{ // Uses the struct from worker.go
		TrackID:       ctx.Track.ID,
		ArtistName:    artistName,
		TrackTitle:    ctx.Meta.Title,
		MusicBrainzID: ctx.MusicBrainzID, // ⚡️ Handing off the acoustic ID!
	}

	trackBytes, _ := json.Marshal(trackPayload)
	trackTask := asynq.NewTask("track:enrich", trackBytes)

	if _, err := ctx.Worker.asynqClient.Enqueue(trackTask); err != nil {
		logger.Log.Warn("Failed to enqueue track enrichment",
			zap.Any("track_id", ctx.Track.ID),
			zap.Error(err),
		)
	} else {
		logger.Log.Info("Enqueued background enrichment task for track",
			zap.Any("track_id", ctx.Track.ID),
		)
	}

	return nil
}
