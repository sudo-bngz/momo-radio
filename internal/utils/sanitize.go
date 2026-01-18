package utils

import (
	"fmt"
	"path/filepath"
	"regexp"
	"strings"
)

var (
	// Regex to match leading track numbers (e.g., "01-", "01 ", "A1 -", "02.")
	reTrackPrefix = regexp.MustCompile(`^([A-Z]?\d+[.\-_ ]+)+`)

	// Regex to match common "Scene" release suffixes to ignore (e.g., "-dh", "-mycel", "_web")
	reJunkSuffix = regexp.MustCompile(`(?i)[-_](dh|mycel|klan|web|vinyl|stream|boss|320kbps)$`)

	// Regex to clean up "feat." or "ft."
	reFeat = regexp.MustCompile(`(?i)\s(\(|\[)?f(ea)?t\.?`)
)

func CleanFilename(filename string) string {
	ext := filepath.Ext(filename)
	clean := strings.TrimSuffix(filename, ext)
	clean = strings.ReplaceAll(clean, "_", " ")
	clean = strings.ReplaceAll(clean, "-", " ")
	return clean
}

func Sanitize(text, def string) string {
	if text == "" {
		return def
	}
	reg, _ := regexp.Compile(`[^a-zA-Z0-9\-\s]+`)
	clean := reg.ReplaceAllString(text, "")
	return strings.ReplaceAll(strings.TrimSpace(clean), " ", "_")
}

func SanitizeYear(dateStr string) string {
	if len(dateStr) >= 4 {
		year := dateStr[:4]
		if match, _ := regexp.MatchString(`^\d{4}$`, year); match {
			return year
		}
	}
	return "0000"
}

// SanitizeFilename extracts a clean "Artist" and "Title" from various filename formats
func SanitizeFilename(baseName string) (string, string) {
	// 1. Remove extension
	name := strings.TrimSuffix(baseName, filepath.Ext(baseName))

	// 2. Normalize separators: Replace underscores and double dashes with standard " - "
	// Example: "chaos_in_the_cbd--green_dove" -> "chaos in the cbd - green dove"
	name = strings.ReplaceAll(name, "--", " - ")
	name = strings.ReplaceAll(name, "_", " ")

	// 3. Remove known junk suffixes (Scene tags)
	name = reJunkSuffix.ReplaceAllString(name, "")

	// 4. Remove leading track numbers (e.g., "01-", "A1 ")
	name = reTrackPrefix.ReplaceAllString(name, "")

	// 5. Clean up extra whitespace
	name = strings.TrimSpace(name)

	// 6. Heuristic Split
	// We look for " - " as the primary separator.
	parts := strings.Split(name, " - ")

	var artist, title string

	if len(parts) >= 3 {
		// Format: Artist - Album - Title (e.g., Fumiya Tanaka - Unknown Possibility - Ant Win Chain)
		artist = strings.TrimSpace(parts[0])
		title = strings.TrimSpace(parts[len(parts)-1]) // Take the last part as title
	} else if len(parts) == 2 {
		// Format: Artist - Title
		artist = strings.TrimSpace(parts[0])
		title = strings.TrimSpace(parts[1])
	} else {
		// Fallback: Can't split, return whole name as title (or try to guess)
		title = name
	}

	// 7. Clean Title Extras (Remove "(Original Mix)", "(Beats Mix)", etc. for better search)
	if idx := strings.Index(title, "("); idx != -1 {
		title = strings.TrimSpace(title[:idx])
	}
	if idx := strings.Index(title, "["); idx != -1 {
		title = strings.TrimSpace(title[:idx])
	}

	return artist, title
}

func CleanQuery(filename string) string {
	// 1. Remove extension
	name := strings.TrimSuffix(filename, filepath.Ext(filename))

	// 2. Split by " - "
	parts := strings.Split(name, " - ")
	if len(parts) < 2 {
		return name // Too simple to clean
	}

	// Usually: [Artist] - [Release/Vol] - [Position] - [Track Title]
	// We want the FIRST part and the LAST part.
	artist := strings.TrimSpace(parts[0])
	title := strings.TrimSpace(parts[len(parts)-1])

	// 3. Clean the Title: Remove parentheticals like "(Original Mix)" or "(Beats Mix)"
	// APIs often work better without these.
	if idx := strings.Index(title, "("); idx != -1 {
		title = strings.TrimSpace(title[:idx])
	}

	// 4. Clean the Title: Remove track positions (e.g., A1, B2, 12 inch mix)
	// This regex looks for patterns like B2 or A1 at the start of the title part
	// but in your case, it's often a separate part of the split.

	return fmt.Sprintf("%s %s", artist, title)
}
