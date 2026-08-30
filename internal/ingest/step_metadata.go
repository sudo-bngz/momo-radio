package ingest

import (
	"bytes"
	"fmt"
	"log/slog"
	"os"
	"strings"

	"momo-radio/internal/models"

	"github.com/dhowden/tag"
)

type MetadataStep struct{}

func (s *MetadataStep) Name() string { return "extracting_id3_tags" }

func (s *MetadataStep) Execute(ctx *ProcessingContext) error {
	// 1. Open the downloaded file
	f, err := os.Open(ctx.RawPath)
	if err != nil {
		slog.Error("Failed to open local file for metadata extraction", "error", err)
		return nil // Don't crash the pipeline, just skip ID3 extraction
	}
	defer f.Close()

	// 2. Read ID3 / FLAC tags
	m, err := tag.ReadFrom(f)
	if err != nil {
		slog.Warn("No metadata tags found in file", "error", err)
		return nil
	}

	// 3. Fetch the track directly from the Database!
	var track models.Track
	if err := ctx.Worker.db.DB.First(&track, ctx.Payload.TrackID).Error; err != nil {
		slog.Error("Failed to find track in DB", "error", err)
		return nil
	}

	// 4. Process Artist
	artistName := strings.TrimSpace(m.Artist())
	if artistName == "" {
		artistName = "Unknown Artist"
	}
	var artist models.Artist
	ctx.Worker.db.DB.Where("name = ? AND organization_id = ?", artistName, track.OrganizationID).
		FirstOrCreate(&artist, models.Artist{Name: artistName, OrganizationID: track.OrganizationID})

	// 5. Process Album & Cover Art
	albumTitle := strings.TrimSpace(m.Album())
	var albumIDPtr *uint

	if albumTitle != "" {
		var album models.Album
		ctx.Worker.db.DB.Where("title = ? AND organization_id = ?", albumTitle, track.OrganizationID).
			FirstOrCreate(&album, models.Album{Title: albumTitle, OrganizationID: track.OrganizationID})

		ctx.Worker.db.DB.Model(&album).Association("Artists").Append(&artist)

		// Save Year
		if m.Year() != 0 && album.Year == "" {
			ctx.Worker.db.DB.Model(&album).Update("year", fmt.Sprintf("%d", m.Year()))
		}

		// Upload Cover Art if missing
		if album.CoverKey == "" && m.Picture() != nil {
			pic := m.Picture()
			picExt := pic.Ext
			if picExt == "" {
				picExt = "jpg"
			}
			coverKey := fmt.Sprintf("covers/%s/album_%d.%s", track.OrganizationID.String(), album.ID, picExt)

			uploadErr := ctx.Worker.storage.UploadAssetFile(coverKey, bytes.NewReader(pic.Data), pic.MIMEType, "public, max-age=31536000")
			if uploadErr == nil {
				ctx.Worker.db.DB.Model(&album).Update("cover_key", coverKey)
			} else {
				slog.Error("Failed to upload cover art to CDN", "error", uploadErr)
			}
		}
		albumIDPtr = &album.ID
	}

	// 6. Update the Track in the Database
	title := strings.TrimSpace(m.Title())
	if title == "" {
		title = "Unknown Track"
	}

	ctx.Worker.db.DB.Model(&track).Updates(map[string]any{
		"title":    title,
		"genre":    strings.TrimSpace(m.Genre()),
		"album_id": albumIDPtr,
	})

	// Link the Artist to the Track
	ctx.Worker.db.DB.Model(&track).Association("Artists").Replace([]models.Artist{artist})

	slog.Info("Successfully extracted metadata and saved to DB", "title", title)
	return nil
}
