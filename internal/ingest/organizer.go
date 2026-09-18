package ingest

import (
	"fmt"
	"path/filepath"
	"strings"

	"go.uber.org/zap"

	"momo-radio/internal/logger"
	"momo-radio/internal/metadata"
	"momo-radio/internal/utils"
)

func BuildPath(meta metadata.Track, originalKey string) string {
	genre := utils.Sanitize(meta.Genre, "Unknown_Genre")
	label := utils.Sanitize(meta.Publisher, "Independent")
	album := utils.Sanitize(meta.Album, "Unknown_Album")
	title := utils.Sanitize(meta.Title, "Unknown_Title")

	rawArtist := "Unknown_Artist"
	if len(meta.Artists) > 0 {
		rawArtist = strings.Join(meta.Artists, "_")
	}
	artist := utils.Sanitize(rawArtist, "Unknown_Artist")

	// Fallback to filename if metadata is completely missing
	if len(meta.Artists) == 0 || meta.Title == "" {
		logger.Log.Warn("Missing core metadata, falling back to original filename",
			zap.String("originalKey", originalKey),
			zap.Int("artistCount", len(meta.Artists)),
			zap.String("title", meta.Title),
		)

		base := filepath.Base(originalKey)
		ext := filepath.Ext(base)
		title = utils.Sanitize(strings.TrimSuffix(base, ext), "Unknown")
		artist = "Unknown_Artist"
	}

	filename := fmt.Sprintf("%s-%s.mp3", artist, title)
	finalPath := fmt.Sprintf("music/%s/%s/%s/%s/%s", genre, label, artist, album, filename)

	logger.Log.Debug("Built storage path for track",
		zap.String("originalKey", originalKey),
		zap.String("finalPath", finalPath),
	)

	return finalPath
}
