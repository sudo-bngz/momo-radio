package utils

import (
	"strings"

	"go.uber.org/zap"

	"momo-radio/internal/logger"
)

// Fallback splitter if Discogs fails or track is completely unknown
func SplitArtistFallback(rawArtist string) []string {
	delimiters := []string{" feat. ", " ft. ", " featuring ", " vs. ", " vs ", " pres. ", ", ", " & "}

	var current = rawArtist
	for _, delim := range delimiters {
		current = strings.ReplaceAll(current, delim, "|")
	}

	var results []string
	for part := range strings.SplitSeq(current, "|") {
		clean := strings.TrimSpace(part)
		if clean != "" {
			results = append(results, clean)
		}
	}

	if len(results) > 1 {
		logger.Log.Debug("Artist name split by fallback string manipulation",
			zap.String("raw_artist", rawArtist),
			zap.Strings("split_results", results),
		)
	}

	return results
}
