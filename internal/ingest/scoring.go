package ingest

import (
	"regexp"
	"strings"
)

var (
	// Matches anything inside parentheses or brackets
	rxParens = regexp.MustCompile(`\(.*?\)`)
	rxBracks = regexp.MustCompile(`\[.*?\]`)

	// Matches common featuring/collaboration keywords
	rxFeat = regexp.MustCompile(`(?i)\b(feat\.?|ft\.?|pres\.?|vs\.?|&)\b`)
)

// NormalizeTitle strips out remix/edit noise (e.g., "Time For Us [Radio Edit]" -> "time for us")
func NormalizeTitle(s string) string {
	s = strings.ToLower(s)
	s = rxParens.ReplaceAllString(s, "")
	s = rxBracks.ReplaceAllString(s, "")
	return strings.TrimSpace(s)
}

// NormalizeArtist removes noise and isolates core artists
// e.g., "Regal (ES) feat. Amelie Lens" -> ["regal", "amelie lens"]
func NormalizeArtist(s string) []string {
	s = strings.ToLower(s)
	s = rxParens.ReplaceAllString(s, "") // Strips (ES), (2), etc.

	// Split by featuring/versus keywords
	parts := rxFeat.Split(s, -1)

	var cleanArtists []string
	for _, p := range parts {
		// Clean up any double spaces or trailing commas
		p = strings.Trim(strings.TrimSpace(p), ",")
		if p != "" {
			cleanArtists = append(cleanArtists, p)
		}
	}
	return cleanArtists
}

// CalculateConfidence scores the safety of an API metadata payload
func CalculateConfidence(hasMBID bool, localArtist, localTitle, apiTitle string, apiArtists []string) int {
	// 1. Acoustic Fingerprint is the ultimate truth
	if hasMBID {
		return 100
	}

	normLocalTitle := NormalizeTitle(localTitle)
	normApiTitle := NormalizeTitle(apiTitle)

	// 2. Title Verification
	// We use Contains to allow for minor API naming differences like "Time For Us EP" vs "Time For Us"
	titleMatch := normLocalTitle == normApiTitle ||
		strings.Contains(normLocalTitle, normApiTitle) ||
		strings.Contains(normApiTitle, normLocalTitle)

	if !titleMatch {
		return 10 // Complete mismatch
	}

	// 3. Artist Verification
	normLocalArtists := NormalizeArtist(localArtist)

	var normApiArtists []string
	for _, a := range apiArtists {
		normApiArtists = append(normApiArtists, NormalizeArtist(a)...)
	}

	exactArtistMatch := false
	partialArtistMatch := false

	for _, la := range normLocalArtists {
		for _, aa := range normApiArtists {
			if la == aa {
				exactArtistMatch = true
				partialArtistMatch = true
				break
			}
			if strings.Contains(la, aa) || strings.Contains(aa, la) {
				partialArtistMatch = true
			}
		}
	}

	if exactArtistMatch {
		return 95 // Title matches and exact artist name matches perfectly
	}

	if partialArtistMatch {
		return 80 // Title matches, and artist is a partial match (e.g. "Regal" vs "Regal (ES)")
	}

	return 10 // Title matches, but the artist is a completely different band (e.g., Procol Harum)
}
