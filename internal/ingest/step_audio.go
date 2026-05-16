package ingest

import (
	"fmt"
	"path/filepath"
	"strings"

	"momo-radio/internal/audio"
	"momo-radio/internal/metadata"
	"momo-radio/internal/utils"
)

// -----------------------------------------------------------------------------
// ANALYSIS & ENRICHMENT STEP
// -----------------------------------------------------------------------------
type AnalysisStep struct{}

func (s *AnalysisStep) Name() string { return "analyzing" }

func (s *AnalysisStep) Execute(ctx *ProcessingContext) error {
	if err := audio.Validate(ctx.RawPath); err != nil {
		return fmt.Errorf("invalid audio file format")
	}

	// 1. Local ID3 Parsing
	meta, err := metadata.GetLocal(ctx.RawPath)
	if err != nil {
		meta = metadata.Track{} // Safe fallback
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

	// 3. API Enrichment (Discogs / iTunes)
	ctx.Worker.updateStatus(ctx.Ctx, ctx.Payload.TrackIDStr(), "enriching", 60)

	searchArtist := "Unknown"
	if len(meta.Artists) > 0 {
		searchArtist = strings.Join(meta.Artists, " ")
	}
	searchTitle := meta.Title

	if searchArtist == "Unknown" || searchTitle == "" {
		cleanA, cleanT := utils.SanitizeFilename(filepath.Base(ctx.Payload.FileKey))
		searchArtist, searchTitle = cleanA, cleanT
	}

	if ctx.Worker.cfg.Services.DiscogsToken != "" {
		enriched, err := metadata.EnrichViaDiscogs(searchArtist, searchTitle, ctx.Worker.cfg.Services.DiscogsToken, ctx.Worker.cfg.Services.ContactEmail)
		if err == nil {
			meta.Genre = enriched.Genre
			meta.Style = enriched.Style
			meta.Publisher = enriched.Publisher
			meta.CatalogNumber = enriched.CatalogNumber
			meta.Country = enriched.Country
			meta.CoverURL = enriched.CoverURL
			if meta.Year == "" {
				meta.Year = enriched.Year
			}
			if meta.Album == "" {
				meta.Album = enriched.Album
			}
			if meta.Title == "" {
				meta.Title = enriched.Title
			}
			if len(enriched.Artists) > 0 {
				meta.Artists = enriched.Artists
			}
		}
	} else {
		itunesMeta, err := metadata.EnrichViaITunes(searchArtist + " " + searchTitle)
		if err == nil {
			if meta.Title == "" {
				meta.Title = itunesMeta.Title
			}
			if meta.Album == "" {
				meta.Album = itunesMeta.Album
			}
			if meta.Genre == "" {
				meta.Genre = itunesMeta.Genre
			}
			if meta.Year == "" {
				meta.Year = itunesMeta.Year
			}
			if len(itunesMeta.Artists) > 0 {
				meta.Artists = itunesMeta.Artists
			}
		}
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
