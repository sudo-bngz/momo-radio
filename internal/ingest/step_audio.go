package ingest

import (
	"fmt"
	"path/filepath"
	"strings"

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

	// 2. Deep Acoustic Analysis (Essentia SVM ML Models)
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
		meta.Energy = analysis.Energy
		meta.MLMoods = analysis.MLMoods
		meta.MLGenres = analysis.MLGenres
		meta.MLCharacteristics = analysis.MLCharacteristics

		// ⚡️ ML FALLBACK LOGIC:
		// If ID3 tags had no genre or mood, inject the top prediction from the ML models
		if strings.TrimSpace(meta.Genre) == "" && len(analysis.MLGenres) > 0 {
			meta.Genre = analysis.MLGenres[0]
			logger.Log.Debug("Applied ML Genre fallback", zap.String("genre", meta.Genre))
		}

		// Map the top ML mood to the primary mood string if it was blank
		if strings.TrimSpace(meta.Mood) == "" && len(analysis.MLMoods) > 0 {
			meta.Mood = analysis.MLMoods[0]
			logger.Log.Debug("Applied ML Mood fallback", zap.String("mood", meta.Mood))
		}
	} else {
		logger.Log.Warn("Deep analysis failed",
			zap.String("raw_path", ctx.RawPath),
			zap.Error(err),
		)
	}

	// 3. Deterministic Acoustic Fingerprinting (Chromaprint / AcoustID)
	ctx.Worker.updateStatus(ctx.Ctx, ctx.Payload.TrackIDStr(), "fingerprinting", 50)

	mbid, err := audio.GetMusicBrainzID(ctx.RawPath, ctx.Worker.cfg.Services.AcoustIDKey)
	if err != nil {
		logger.Log.Warn("Acoustic fingerprinting skipped/failed",
			zap.Any("track_id", ctx.Payload.TrackID),
			zap.Error(err),
		)
	} else {
		logger.Log.Info("Successfully fingerprinted track",
			zap.Any("track_id", ctx.Payload.TrackID),
			zap.String("mbid", mbid),
		)
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
