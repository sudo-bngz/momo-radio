package ingest

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"

	"github.com/hibiken/asynq"

	"momo-radio/internal/metadata"
	"momo-radio/internal/models"
)

func (w *Worker) HandleTrackEnrichTask(ctx context.Context, t *asynq.Task) error {
	var payload localTrackEnrichPayload
	if err := json.Unmarshal(t.Payload(), &payload); err != nil {
		return fmt.Errorf("failed to parse track enrich payload: %v", err)
	}

	// 1. Fetch Track with related Artists and Album
	var track models.Track
	if err := w.db.DB.Preload("Artists").Preload("Album").First(&track, payload.TrackID).Error; err != nil {
		return fmt.Errorf("track not found: %w", err)
	}

	// Skip if completely enriched
	cleanGenre := strings.TrimSpace(track.Genre)
	hasValidGenre := cleanGenre != "" && cleanGenre != "-" && strings.ToLower(cleanGenre) != "unknown"
	hasStyle := strings.TrimSpace(track.Style) != ""
	hasCoverArt := track.AlbumID != nil && track.Album.CoverKey != ""
	hasAlbumDetails := track.AlbumID != nil && track.Album.Publisher != "" && track.Album.Year != ""

	if hasValidGenre && hasStyle && hasCoverArt && hasAlbumDetails {
		log.Printf("Track %d already fully enriched. Skipping.", track.ID)
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
		log.Printf("Querying MusicBrainz for exact MBID: %s...", payload.MusicBrainzID)
		mbResult, err := metadata.FetchFromMusicBrainz(payload.MusicBrainzID, email)
		if err == nil && mbResult.ArtistName != "" {
			mbData = mbResult
			hasAcousticMatch = true

			// UPGRADE OUR SEARCH STRINGS! We now have the verified truth.
			cleanSearchArtist = mbResult.ArtistName
			if mbResult.ReleaseName != "" {
				cleanSearchTitle = mbResult.ReleaseName // Search by Album/Release, not Track
			}
			log.Printf("Acoustic Match Found! Upgrading search to: '%s - %s'", cleanSearchArtist, cleanSearchTitle)
		} else {
			log.Printf("MusicBrainz fallback failed/empty: %v", err)
		}
	}

	// -------------------------------------------------------------------------
	// TIER 2: Discogs (Underground Tags & Deep Catalog)
	// -------------------------------------------------------------------------
	var finalGenre, finalStyle, finalYear, finalPublisher, finalCountry, finalCoverURL string

	log.Printf("Querying Discogs for Release Data: '%s' - '%s'...", cleanSearchArtist, cleanSearchTitle)
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
			log.Printf("Discogs Match! (Score: %d%%)", score)
		} else {
			log.Printf("Discogs rejected by Confidence Score (%d%%)", score)
		}
	} else {
		log.Printf("Discogs enrich failed: %v", err)
	}

	// -------------------------------------------------------------------------
	// TIER 3: iTunes (Mainstream Fallback)
	// -------------------------------------------------------------------------
	if !discogsValid {
		log.Printf("Falling back to iTunes for '%s - %s'...", cleanSearchArtist, cleanSearchTitle)
		itunesData, err := metadata.EnrichViaITunes(cleanSearchArtist, cleanSearchTitle)

		if err == nil {
			score := CalculateConfidence(hasAcousticMatch, payload.ArtistName, payload.TrackTitle, itunesData.TrackTitle, []string{itunesData.ArtistName})

			if score >= 80 {
				finalGenre = itunesData.Genre // iTunes doesn't do "Styles", just Genres
				finalYear = itunesData.Year
				finalCoverURL = itunesData.CoverURL
				log.Printf("iTunes Match! (Score: %d%%)", score)
			} else {
				log.Printf("iTunes rejected by Confidence Score (%d%%)", score)
			}
		} else {
			log.Printf("iTunes enrich failed: %v", err)
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
					}
				}
			}
		}

		if len(albumUpdates) > 0 {
			w.db.DB.Model(&album).Updates(albumUpdates)
		}
	}

	log.Printf("Successfully completed Cascading Enrichment for track %d", track.ID)
	return nil
}
