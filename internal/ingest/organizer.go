package ingest

import (
	"fmt"
	"momo-radio/internal/metadata"
	"momo-radio/internal/utils"
	"path/filepath"
	"strings"
)

func BuildPath(meta metadata.Track, originalKey string) string {
	genre := utils.Sanitize(meta.Genre, "Unknown_Genre")
	label := utils.Sanitize(meta.Publisher, "Independent")
	album := utils.Sanitize(meta.Album, "Unknown_Album")
	artist := utils.Sanitize(meta.Artist, "Unknown_Artist")
	title := utils.Sanitize(meta.Title, "Unknown_Title")

	// Fallback to filename if metadata is completely missing
	if meta.Artist == "" || meta.Title == "" {
		base := filepath.Base(originalKey)
		ext := filepath.Ext(base)
		title = utils.Sanitize(strings.TrimSuffix(base, ext), "Unknown")
		artist = "Unknown"
	}

	filename := fmt.Sprintf("%s-%s.mp3", artist, title)

	return fmt.Sprintf("music/%s/%s/%s/%s/%s", genre, label, artist, album, filename)
}
