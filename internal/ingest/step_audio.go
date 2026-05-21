package ingest

import (
	"fmt"
	"log"
	"path/filepath"

	"momo-radio/internal/audio"
	"momo-radio/internal/metadata"
	"momo-radio/internal/utils"
)

// -----------------------------------------------------------------------------
// ANALYSIS STEP (Acoustic, Local Metadata, and Fingerprinting ONLY)
// -----------------------------------------------------------------------------
type AnalysisStep struct{}

func (s *AnalysisStep) Name() string { return "analyzing" }

func (s *AnalysisStep) Execute(ctx *ProcessingContext) error {
	if err := audio.Validate(ctx.RawPath); err != nil {
		return fmt.Errorf("invalid audio file format")
	}

	// 1. Local ID3/FLAC Parsing ONLY (No APIs)
	meta, err := metadata.GetLocal(ctx.RawPath)
	if err != nil {
		meta = metadata.Track{}
	}

	// Fallback to filename parsing ONLY if the file has zero embedded tags
	if len(meta.Artists) == 0 || meta.Title == "" {
		cleanA, cleanT := utils.SanitizeFilename(filepath.Base(ctx.Payload.FileKey))
		if len(meta.Artists) == 0 {
			meta.Artists = []string{cleanA}
		}
		if meta.Title == "" {
			meta.Title = cleanT
		}
	}

	// 2. Deep Acoustic Analysis (Essentia)
	ctx.Worker.analysisSem <- struct{}{}
	analysis, err := audio.AnalyzeDeep(ctx.RawPath)
	<-ctx.Worker.analysisSem

	if err == nil {
		meta.BPM = analysis.BPM
		meta.MusicalKey = analysis.MusicalKey
		meta.Scale = analysis.Scale
		meta.Danceability = analysis.Danceability
		meta.Loudness = analysis.Loudness
		meta.Duration = analysis.Duration
	}

	// 3. Deterministic Acoustic Fingerprinting (Chromaprint / AcoustID)
	ctx.Worker.updateStatus(ctx.Ctx, ctx.Payload.TrackIDStr(), "fingerprinting", 50)

	mbid, err := audio.GetMusicBrainzID(ctx.RawPath, ctx.Worker.cfg.Services.AcoustIDKey)
	if err != nil {
		log.Printf("Acoustic fingerprinting skipped/failed for track %d: %v", ctx.Payload.TrackID, err)
	} else {
		log.Printf("Successfully fingerprinted Track %d: MusicBrainz ID [%s]", ctx.Payload.TrackID, mbid)
		ctx.MusicBrainzID = mbid // Save it securely to the context pipeline
	}

	ctx.Meta = &meta
	return nil
}

// -----------------------------------------------------------------------------
// NORMALIZE STEP
// -----------------------------------------------------------------------------
type NormalizeStep struct{}

func (s *NormalizeStep) Name() string { return "normalizing" }

func (s *NormalizeStep) Execute(ctx *ProcessingContext) error {
	return audio.Normalize(ctx.RawPath, ctx.CleanPath)
}
