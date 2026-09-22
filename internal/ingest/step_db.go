package ingest

import (
	"bytes"
	"fmt"
	"strings"

	"github.com/lib/pq"
	"go.uber.org/zap"
	"gorm.io/gorm"

	"momo-radio/internal/logger"
	"momo-radio/internal/metadata"
	"momo-radio/internal/models"
)

// -----------------------------------------------------------------------------
// DATABASE SAVE STEP
// -----------------------------------------------------------------------------
type DatabaseSaveStep struct{}

func (s *DatabaseSaveStep) Name() string { return "saving" }

func (s *DatabaseSaveStep) Execute(ctx *ProcessingContext) error {
	db := ctx.Worker.db.DB
	track := ctx.Track
	meta := ctx.Meta

	logger.Log.Debug("Starting database save step", zap.Any("track_id", track.ID))

	// Ensure we have at least an "Unknown Artist" to avoid empty arrays
	if len(meta.Artists) == 0 {
		meta.Artists = []string{"Unknown Artist"}
	}

	// 1. Clear old artists (crucial for retries/repairs)
	db.Model(track).Association("Artists").Clear()

	// 2. Sanitize & Split Artists before DB Insertion
	var trackArtists []models.Artist

	for _, rawName := range meta.Artists {
		parsedNames := NormalizeArtist(rawName)

		for _, cleanName := range parsedNames {
			cleanName = strings.TrimSpace(cleanName)
			if cleanName == "" {
				continue
			}

			var artist models.Artist
			db.Where("name = ? AND organization_id = ?", cleanName, track.OrganizationID).
				FirstOrCreate(&artist, models.Artist{Name: cleanName, OrganizationID: track.OrganizationID})

			if artist.ArtistCountry == "" && meta.Country != "" {
				db.Model(&artist).Update("ArtistCountry", meta.Country)
			}

			trackArtists = append(trackArtists, artist)
		}
	}

	if len(trackArtists) == 0 {
		var artist models.Artist
		db.Where("name = ? AND organization_id = ?", "Unknown Artist", track.OrganizationID).
			FirstOrCreate(&artist, models.Artist{Name: "Unknown Artist", OrganizationID: track.OrganizationID})
		trackArtists = append(trackArtists, artist)
	}
	db.Model(track).Association("Artists").Append(trackArtists)

	logger.Log.Debug("Associated artists with track",
		zap.Int("artist_count", len(trackArtists)),
		zap.Any("track_id", track.ID),
	)

	// 3. Setup Album using the newly resolved Artists
	var albumID *uint
	if meta.Album != "" && len(trackArtists) > 0 {
		var album models.Album

		err := db.Where(models.Album{Title: meta.Album, OrganizationID: track.OrganizationID}).First(&album).Error

		if err == gorm.ErrRecordNotFound {
			album = models.Album{
				Title:          meta.Album,
				OrganizationID: track.OrganizationID,
				Year:           meta.Year,
				Publisher:      meta.Publisher,
				CatalogNumber:  meta.CatalogNumber,
				ReleaseCountry: meta.Country,
			}
			db.Create(&album)
		} else {
			updates := map[string]interface{}{}
			if album.Year == "" && meta.Year != "" {
				updates["year"] = meta.Year
			}
			if album.Publisher == "" && meta.Publisher != "" {
				updates["publisher"] = meta.Publisher
			}
			if album.ReleaseCountry == "" && meta.Country != "" {
				updates["release_country"] = meta.Country
			}
			if len(updates) > 0 {
				db.Model(&album).Updates(updates)
			}
		}

		db.Model(&album).Association("Artists").Append(trackArtists)
		albumID = &album.ID

		// 4. Handle Cover Art
		if album.CoverKey == "" {
			var rawImage []byte
			var errImg error
			if len(meta.AttachedPicture) > 0 {
				rawImage = meta.AttachedPicture
			} else if meta.CoverURL != "" {
				rawImage, errImg = metadata.DownloadImage(meta.CoverURL, ctx.Worker.cfg.Services.DiscogsToken)
			}

			if len(rawImage) > 0 && errImg == nil {
				if processedImg, errProc := metadata.ProcessCover(rawImage); errProc == nil {
					coverKey := fmt.Sprintf("covers/%s/album_%d.jpg", ctx.Track.OrganizationID, album.ID)
					if errUpload := ctx.Worker.storage.UploadAssetFile(coverKey, bytes.NewReader(processedImg), "image/jpeg", "public, max-age=31536000"); errUpload == nil {
						db.Model(&album).Update("CoverKey", coverKey)
						logger.Log.Debug("Uploaded and linked album cover", zap.String("cover_key", coverKey), zap.Any("album_id", album.ID))
					} else {
						logger.Log.Warn("Failed to upload album cover", zap.Error(errUpload), zap.Any("album_id", album.ID))
					}
				} else {
					logger.Log.Warn("Failed to process album cover image", zap.Error(errProc), zap.Any("album_id", album.ID))
				}
			} else if errImg != nil {
				logger.Log.Warn("Failed to download album cover image", zap.Error(errImg), zap.String("cover_url", meta.CoverURL))
			}
		}
	}

	// 5. Finalize Track Updates Safely (⚡️ THE FIX IS HERE)
	updates := map[string]any{
		"key":                 ctx.DestKey,
		"title":               meta.Title,
		"album_id":            albumID,
		"format":              "mp3",
		"bpm":                 meta.BPM,
		"duration":            meta.Duration,
		"musical_key":         meta.MusicalKey,
		"scale":               meta.Scale,
		"danceability":        meta.Danceability,
		"loudness":            meta.Loudness,
		"energy":              meta.Energy,
		"ml_moods":            pq.StringArray(meta.MLMoods),
		"ml_genres":           pq.StringArray(meta.MLGenres),
		"ml_characteristics":  pq.StringArray(meta.MLCharacteristics),
		"processing_status":   "completed",
		"processing_progress": 100,
	}

	// Only apply these if they actually exist, otherwise leave the DB row alone!
	if cleanGenre := NormalizeTags(meta.Genre); cleanGenre != "" {
		updates["genre"] = cleanGenre
	}
	if cleanStyle := NormalizeTags(meta.Style); cleanStyle != "" {
		updates["style"] = cleanStyle
	}
	if meta.Mood != "" { // Assuming meta.Mood exists on your metadata struct
		updates["mood"] = meta.Mood
	}

	// Execute the partial update
	if err := db.Model(track).Updates(updates).Error; err != nil {
		logger.Log.Error("Failed to save final track state to database", zap.Any("track_id", track.ID), zap.Error(err))
		return err
	}

	// Force GORM to fetch the completely up-to-date row back into memory
	if err := db.Preload("Album").Preload("Artists").First(ctx.Track, ctx.Track.ID).Error; err != nil {
		logger.Log.Error("Failed to reload track associations", zap.Any("track_id", track.ID), zap.Error(err))
		return fmt.Errorf("failed to reload track associations: %w", err)
	}

	logger.Log.Info("Successfully saved track and associations to database", zap.Any("track_id", track.ID))
	return nil
}
