package utils

import "strings"

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
	return results
}
