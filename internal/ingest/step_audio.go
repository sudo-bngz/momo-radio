package ingest

import (
	"fmt"
	"path/filepath"

	"go.uber.org/zap"

	"momo-radio/internal/audio"
	"momo-radio/internal/logger"
	"momo-radio/internal/metadata"
	"momo-radio/internal/utils"
)

// -----------------------------------------------------------------------------
// ANALYSIS STEP
// -----------------------------------------------------------------------------
type AnalysisStep struct{}

func (s *AnalysisStep) Name() string { return "analyzing" }

func (s *AnalysisStep) Execute(ctx *ProcessingContext) error {
	if err := audio.Validate(ctx.RawPath); err != nil {
		return fmt.Errorf("invalid audio file format")
	}

	// Safely initialize if empty, preserving what step_metadata.go already did!
	if ctx.Meta == nil {
		ctx.Meta = &metadata.Track{}
	}

	// Fallback to filename parsing ONLY if the file has zero embedded tags
	if len(ctx.Meta.Artists) == 0 || ctx.Meta.Title == "" {
		cleanA, cleanT := utils.SanitizeFilename(filepath.Base(ctx.Payload.FileKey))
		if len(ctx.Meta.Artists) == 0 {
			ctx.Meta.Artists = []string{cleanA}
		}
		if ctx.Meta.Title == "" {
			ctx.Meta.Title = cleanT
		}
	}

	// 2. Deep Acoustic Analysis (Essentia SVM ML Models)
	ctx.Worker.analysisSem <- struct{}{}
	analysis, err := audio.AnalyzeDeep(ctx.RawPath)
	<-ctx.Worker.analysisSem

	if err == nil {
		ctx.Meta.BPM = analysis.BPM
		ctx.Meta.MusicalKey = analysis.MusicalKey
		ctx.Meta.Scale = analysis.Scale
		ctx.Meta.Danceability = analysis.Danceability
		ctx.Meta.Loudness = analysis.Loudness
		ctx.Meta.Duration = analysis.Duration
		ctx.Meta.Energy = analysis.Energy
		ctx.Meta.MLMoods = analysis.MLMoods
		ctx.Meta.MLGenres = analysis.MLGenres
		ctx.Meta.MLCharacteristics = analysis.MLCharacteristics
	} else {
		logger.Log.Warn("Deep analysis failed", zap.String("raw_path", ctx.RawPath), zap.Error(err))
	}

	// 3. Acoustic Fingerprinting
	ctx.Worker.updateStatus(ctx.Ctx, ctx.Payload.TrackIDStr(), "fingerprinting", 50)

	mbid, err := audio.GetMusicBrainzID(ctx.RawPath, ctx.Worker.cfg.Services.AcoustIDKey)
	if err != nil {
		logger.Log.Warn("Acoustic fingerprinting skipped/failed", zap.Any("track_id", ctx.Payload.TrackID), zap.Error(err))
	} else {
		ctx.MusicBrainzID = mbid
	}

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
