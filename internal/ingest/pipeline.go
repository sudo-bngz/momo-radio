package ingest

import (
	"context"
	"momo-radio/internal/metadata"
	"momo-radio/internal/models"
)

// ProcessingContext holds all state shared across the pipeline steps
type ProcessingContext struct {
	Worker    *Worker
	Ctx       context.Context
	Payload   TrackProcessPayload
	Track     *models.Track
	OrgID     string
	RawPath   string
	CleanPath string
	Meta      *metadata.Track
	DestKey   string
}

// Step defines a single, isolated piece of the processing pipeline
type Step interface {
	Name() string
	Execute(ctx *ProcessingContext) error
}
