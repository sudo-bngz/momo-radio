package m3u

import (
	"fmt"
	"net/url"
	"path/filepath"
	"strings"

	"momo-radio/internal/models"
)

// Generate builds an EXTM3U formatted string for a playlist
func Generate(tracks []models.Track) []byte {
	var sb strings.Builder

	// Write the M3U Header
	sb.WriteString("#EXTM3U\n")

	for _, t := range tracks {
		if t.Key == "" {
			continue
		}

		// Calculate duration in seconds
		duration := int(t.Duration)
		if duration == 0 {
			duration = -1 // -1 means unknown duration in M3U
		}

		// Join the multiple artists into a single string for the M3U tag
		var artistNames []string
		for _, a := range t.Artists {
			artistNames = append(artistNames, a.Name)
		}
		artistStr := "Unknown Artist"
		if len(artistNames) > 0 {
			artistStr = strings.Join(artistNames, ", ")
		}

		// Safely escape the filename just like we do for the actual downloaded file
		safeFilename := url.PathEscape(filepath.Base(t.Key))

		// Write the Extended Info (Artist(s) - Title)
		extInf := fmt.Sprintf("#EXTINF:%d,%s - %s\n", duration, artistStr, t.Title)
		sb.WriteString(extInf)

		// Write the relative file path (just the filename, since it sits in the same folder)
		sb.WriteString(safeFilename + "\n")
	}

	return []byte(sb.String())
}
