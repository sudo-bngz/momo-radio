package ingest

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/hibiken/asynq"
	"go.uber.org/zap"

	"momo-radio/internal/logger"
	"momo-radio/internal/metadata"
	"momo-radio/internal/models"
)

func (w *Worker) HandleTrackEnrichTask(ctx context.Context, t *asynq.Task) error {
	var payload localTrackEnrichPayload
	if err := json.Unmarshal(t.Payload(), &payload); err != nil {
		logger.Log.Error("Failed to parse track enrich payload", zap.Error(err))
		return fmt.Errorf("failed to parse track enrich payload: %v", err)
	}

	// 1. Fetch Track with related Artists and Album
	var track models.Track
	if err := w.db.DB.Preload("Artists").Preload("Album").First(&track, payload.TrackID).Error; err != nil {
		logger.Log.Error("Track not found for enrichment",
			zap.Any("track_id", payload.TrackID),
			zap.Error(err),
		)
		return fmt.Errorf("track not found: %w", err)
	}

	// Skip if completely enriched
	cleanGenre := strings.TrimSpace(track.Genre)
	hasValidGenre := cleanGenre != "" && cleanGenre != "-" && strings.ToLower(cleanGenre) != "unknown"
	hasStyle := strings.TrimSpace(track.Style) != ""
	hasCoverArt := track.AlbumID != nil && track.Album.CoverKey != ""
	hasAlbumDetails := track.AlbumID != nil && track.Album.Publisher != "" && track.Album.Year != ""

	if hasValidGenre && hasStyle && hasCoverArt && hasAlbumDetails {
		logger.Log.Info("Track already fully enriched. Skipping.", zap.Any("track_id", track.ID))
		return nil
	}

	// -------------------------------------------------------------------------
	// PREPARE CLEAN SEARCH STRINGS
	// -------------------------------------------------------------------------
	email := w.cfg.Services.ContactEmail
	apiToken := w.cfg.Services.DiscogsToken
	hasAcousticMatch := false

	// Strip noise BEFORE querying the APIs
	cleanSearchTitle := NormalizeTitle(payload.TrackTitle)
	cleanSearchArtist := payload.ArtistName
	if parsedArtists := NormalizeArtist(payload.ArtistName); len(parsedArtists) > 0 {
		cleanSearchArtist = parsedArtists[0]
	}

	// -------------------------------------------------------------------------
	// TIER 1: MusicBrainz (The Acoustic Anchor)
	// -------------------------------------------------------------------------
	var mbData *metadata.MusicBrainzRelease
	if payload.MusicBrainzID != "" {
		logger.Log.Info("Querying MusicBrainz for exact MBID", zap.String("mbid", payload.MusicBrainzID))
		mbResult, err := metadata.FetchFromMusicBrainz(payload.MusicBrainzID, email)
		if err == nil && mbResult.ArtistName != "" {
			mbData = mbResult
			hasAcousticMatch = true

			// UPGRADE OUR SEARCH STRINGS! We now have the verified truth.
			cleanSearchArtist = mbResult.ArtistName
			if mbResult.ReleaseName != "" {
				cleanSearchTitle = mbResult.ReleaseName // Search by Album/Release, not Track
			}
			logger.Log.Info("Acoustic Match Found! Upgrading search strings",
				zap.String("search_artist", cleanSearchArtist),
				zap.String("search_title", cleanSearchTitle),
			)
		} else {
			logger.Log.Warn("MusicBrainz fallback failed or empty", zap.Error(err))
		}
	}

	// -------------------------------------------------------------------------
	// TIER 2: Discogs (Underground Tags & Deep Catalog)
	// -------------------------------------------------------------------------
	var finalGenre, finalStyle, finalYear, finalPublisher, finalCountry, finalCoverURL string

	logger.Log.Info("Querying Discogs for Release Data",
		zap.String("search_artist", cleanSearchArtist),
		zap.String("search_title", cleanSearchTitle),
	)

	discogsData, err := metadata.EnrichViaDiscogs(cleanSearchArtist, cleanSearchTitle, apiToken, email)
	discogsValid := false

	if err == nil {
		apiArtists := discogsData.Artists
		if len(apiArtists) == 0 {
			apiArtists = []string{cleanSearchArtist}
		}

		score := CalculateConfidence(hasAcousticMatch, payload.ArtistName, payload.TrackTitle, discogsData.Title, apiArtists)
		if score >= 80 {
			discogsValid = true
			finalGenre = discogsData.Genre
			finalStyle = discogsData.Style
			finalYear = discogsData.Year
			finalPublisher = discogsData.Publisher
			finalCountry = discogsData.Country
			finalCoverURL = discogsData.CoverURL
			logger.Log.Info("Discogs Match!", zap.Int("confidence_score", score))
		} else {
			logger.Log.Info("Discogs rejected by Confidence Score", zap.Int("confidence_score", score))
		}
	} else {
		logger.Log.Warn("Discogs enrich failed", zap.Error(err))
	}

	// -------------------------------------------------------------------------
	// TIER 3: iTunes (Mainstream Fallback)
	// -------------------------------------------------------------------------
	if !discogsValid {
		logger.Log.Info("Falling back to iTunes",
			zap.String("search_artist", cleanSearchArtist),
			zap.String("search_title", cleanSearchTitle),
		)
		itunesData, err := metadata.EnrichViaITunes(cleanSearchArtist, cleanSearchTitle)

		if err == nil {
			score := CalculateConfidence(hasAcousticMatch, payload.ArtistName, payload.TrackTitle, itunesData.TrackTitle, []string{itunesData.ArtistName})

			if score >= 80 {
				finalGenre = itunesData.Genre // iTunes doesn't do "Styles", just Genres
				finalYear = itunesData.Year
				finalCoverURL = itunesData.CoverURL
				logger.Log.Info("iTunes Match!", zap.Int("confidence_score", score))
			} else {
				logger.Log.Info("iTunes rejected by Confidence Score", zap.Int("confidence_score", score))
			}
		} else {
			logger.Log.Warn("iTunes enrich failed", zap.Error(err))
		}
	}

	// Override Year with MusicBrainz if it's available (MB is the most accurate for dates)
	if mbData != nil && mbData.Year != "" {
		finalYear = mbData.Year
	}

	// -------------------------------------------------------------------------
	// THE MERGE: Safely apply the best data to the Database
	// -------------------------------------------------------------------------

	updates := map[string]interface{}{}
	if track.Genre == "" && finalGenre != "" {
		updates["genre"] = finalGenre
	}
	if track.Style == "" && finalStyle != "" {
		updates["style"] = finalStyle
	}
	if len(updates) > 0 {
		w.db.DB.Model(&track).Updates(updates)
	}

	if track.AlbumID != nil {
		var album models.Album
		w.db.DB.First(&album, *track.AlbumID)

		albumUpdates := map[string]interface{}{}

		if album.Year == "" && finalYear != "" {
			albumUpdates["year"] = finalYear
		}
		if album.Publisher == "" && finalPublisher != "" {
			albumUpdates["publisher"] = finalPublisher
		}
		if album.ReleaseCountry == "" && finalCountry != "" {
			albumUpdates["release_country"] = finalCountry
		}

		if album.CoverKey == "" && finalCoverURL != "" {
			rawImage, errImg := metadata.DownloadImage(finalCoverURL, apiToken)
			if errImg == nil && len(rawImage) > 0 {
				if processedImg, errProc := metadata.ProcessCover(rawImage); errProc == nil {
					coverKey := fmt.Sprintf("covers/%s/album_%d.jpg", track.OrganizationID, album.ID)
					if errUpload := w.storage.UploadAssetFile(coverKey, bytes.NewReader(processedImg), "image/jpeg", "public, max-age=31536000"); errUpload == nil {
						albumUpdates["cover_key"] = coverKey
						logger.Log.Debug("Uploaded enriched cover art to CDN", zap.String("cover_key", coverKey))
					} else {
						logger.Log.Warn("Failed to upload enriched cover art", zap.Error(errUpload))
					}
				} else {
					logger.Log.Warn("Failed to process enriched cover image", zap.Error(errProc))
				}
			} else {
				logger.Log.Warn("Failed to download enriched cover image",
					zap.String("cover_url", finalCoverURL),
					zap.Error(errImg),
				)
			}
		}

		if len(albumUpdates) > 0 {
			w.db.DB.Model(&album).Updates(albumUpdates)
		}
	}

	logger.Log.Info("Successfully completed Cascading Enrichment", zap.Any("track_id", track.ID))
	return nil
}
