package utils

import (
	"path/filepath"
	"regexp"
	"strings"
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
