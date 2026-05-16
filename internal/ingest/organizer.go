package ingest

import (
	"fmt"
	"path/filepath"
	"strings"

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
		base := filepath.Base(originalKey)
		ext := filepath.Ext(base)
		title = utils.Sanitize(strings.TrimSuffix(base, ext), "Unknown")
		artist = "Unknown_Artist"
	}

	filename := fmt.Sprintf("%s-%s.mp3", artist, title)

	return fmt.Sprintf("music/%s/%s/%s/%s/%s", genre, label, artist, album, filename)
}
