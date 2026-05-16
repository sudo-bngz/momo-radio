package ingest

import (
	"bytes"
	"fmt"

	"gorm.io/gorm"

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

	// Ensure we have at least an "Unknown Artist" to avoid empty arrays
	if len(meta.Artists) == 0 {
		meta.Artists = []string{"Unknown Artist"}
	}

	// 1. Clear old artists (crucial for retries/repairs)
	db.Model(track).Association("Artists").Clear()

	// 2. Find/Create & Append Multiple Artists
	var trackArtists []models.Artist // Keep track of the resolved artist structs
	for _, name := range meta.Artists {
		var artist models.Artist
		db.Where(models.Artist{Name: name, OrganizationID: track.OrganizationID}).
			FirstOrCreate(&artist, models.Artist{Name: name, OrganizationID: track.OrganizationID})

		// Map country from Discogs if missing
		if artist.ArtistCountry == "" && meta.Country != "" {
			db.Model(&artist).Update("ArtistCountry", meta.Country)
		}

		trackArtists = append(trackArtists, artist)
		track.Artists = append(track.Artists, artist)
	}

	// 3. Setup Album using the newly resolved Artists
	var albumID *uint
	if meta.Album != "" && len(trackArtists) > 0 {
		var album models.Album

		// ⚡️ FIXED: Removed ArtistID. Query by Title and Organization only.
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
			// Update missing album fields non-destructively
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
					coverKey := fmt.Sprintf("covers/%s/album_%d.jpg", ctx.OrgID, album.ID)
					if errUpload := ctx.Worker.storage.UploadAssetFile(coverKey, bytes.NewReader(processedImg), "image/jpeg", "public, max-age=31536000"); errUpload == nil {
						db.Model(&album).Update("CoverKey", coverKey)
					}
				}
			}
		}
	}

	// 5. Finalize Track Updates
	db.Model(track).Updates(map[string]interface{}{
		"key":                 ctx.DestKey,
		"title":               meta.Title,
		"album_id":            albumID,
		"genre":               meta.Genre,
		"style":               meta.Style,
		"format":              "mp3",
		"bpm":                 meta.BPM,
		"duration":            meta.Duration,
		"musical_key":         meta.MusicalKey,
		"scale":               meta.Scale,
		"danceability":        meta.Danceability,
		"loudness":            meta.Loudness,
		"processing_status":   "completed",
		"processing_progress": 100,
	})

	// Save the Many-to-Many associations explicitly
	return db.Save(track).Error
}
