package ingest

import (
	"regexp"
	"strings"
	"unicode"
)

var (
	// Matches anything inside parentheses or brackets
	rxParens = regexp.MustCompile(`\(.*?\)`)
	rxBracks = regexp.MustCompile(`\[.*?\]`)
	rxNoise  = regexp.MustCompile(`\s*\([^)]*\)|\s*\[[^]]*\]`)
	rxSplit  = regexp.MustCompile(`(?i)\s+(feat\.?|ft\.?|pres\.?|vs\.?|&|x)\s+`)
	rxFeat   = regexp.MustCompile(`(?i)\b(feat\.?|ft\.?|pres\.?|vs\.?|&)\b`)
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

	var finalArtists []string
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}

		p = strings.ReplaceAll(p, " _AND_ ", " & ")
		p = strings.ReplaceAll(p, " _VS_ ", " vs ")
		p = strings.ReplaceAll(p, " _X_ ", " x ")
		p = FormatArtistName(p)

		finalArtists = append(finalArtists, p)
	}

	return finalArtists
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

// FormatArtistName forces "roza terenzi" to "Roza Terenzi" natively
func FormatArtistName(name string) string {
	words := strings.Fields(name)
	for i, w := range words {
		if len(w) > 0 {
			r := []rune(w)
			r[0] = unicode.ToUpper(r[0])
			words[i] = string(r)
		}
	}
	return strings.Join(words, " ")
}

// NormalizeTags standardizes messy ID3 genres/styles (e.g., "Minimal / Deep Tech; House")
// into a clean, comma-separated string (e.g., "Minimal, Deep Tech, House")
func NormalizeTags(raw string) string {
	if raw == "" {
		return ""
	}

	// 1. Replace common DJ software separators with commas
	replacer := strings.NewReplacer(
		"/", ",",
		";", ",",
		"|", ",",
		"\\", ",",
	)
	commaString := replacer.Replace(raw)

	// 2. Split, trim, and deduplicate
	parts := strings.Split(commaString, ",")
	var cleanTags []string
	seen := make(map[string]bool)

	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}

		// 3. Format to Title Case using our existing helper!
		// This forces "deep tech" to become "Deep Tech"
		p = FormatArtistName(p)

		if !seen[p] {
			cleanTags = append(cleanTags, p)
			seen[p] = true
		}
	}

	return strings.Join(cleanTags, ", ")
}
