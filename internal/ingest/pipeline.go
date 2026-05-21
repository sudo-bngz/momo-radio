package ingest

import (
	"context"
	"momo-radio/internal/metadata"
	"momo-radio/internal/models"
)

// ⚡️ FIXED: Added the pipeline context structs here so they are globally available
type ProcessingContext struct {
	Worker        *Worker
	Ctx           context.Context
	Payload       TrackProcessPayload
	RawPath       string
	CleanPath     string
	DestKey       string
	OrgID         string
	Track         *models.Track
	Meta          *metadata.Track
	MusicBrainzID string
}

type Step interface {
	Name() string
	Execute(ctx *ProcessingContext) error
}
