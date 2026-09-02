package handlers

import (
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/meilisearch/meilisearch-go"
)

type SearchHandler struct {
	meili meilisearch.ServiceManager
}

func NewSearchHandler(meili meilisearch.ServiceManager) *SearchHandler {
	return &SearchHandler{meili: meili}
}

// SearchLibrary fetches tracks using advanced query parsing
func (h *SearchHandler) SearchLibrary(c *gin.Context) {
	orgID, ok := getOrgID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: missing organization context"})
		return
	}

	rawQuery := c.Query("q")
	limitStr := c.DefaultQuery("limit", "20")
	limit, _ := strconv.ParseInt(limitStr, 10, 64)

	// Extract explicit filters and the cleaned text query
	cleanQuery, filterStr := parseAdvancedQuery(rawQuery, orgID.String())

	// Legacy support for explicit query params
	if scale := c.Query("scale"); scale != "" {
		filterStr += fmt.Sprintf(" AND scale = '%s'", scale)
	}
	if genre := c.Query("genre"); genre != "" {
		filterStr += fmt.Sprintf(" AND genre = '%s'", genre)
	}

	searchRes, err := h.meili.Index("tracks").Search(cleanQuery, &meilisearch.SearchRequest{
		Filter: filterStr,
		Limit:  limit,
	})

	if err != nil {
		fmt.Printf("❌ Meilisearch error: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to search library"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"hits":                 searchRes.Hits,
		"estimated_total_hits": searchRes.EstimatedTotalHits,
		"query":                cleanQuery, // The stripped text query sent to Meilisearch
		"raw_query":            rawQuery,   // The original string to preserve frontend UI state
	})
}

// parseAdvancedQuery extracts key:value pairs and builds a Meilisearch filter string
func parseAdvancedQuery(rawQuery string, orgID string) (string, string) {
	filterStr := fmt.Sprintf("organization_id = '%s'", orgID)
	cleanQuery := rawQuery

	// Matches `key:value` or `key:"value with spaces"`
	re := regexp.MustCompile(`(?i)(\w+):(".*?"|\S+)`)
	matches := re.FindAllStringSubmatch(rawQuery, -1)

	// Map UI shortcuts to actual Meilisearch indexed fields
	fieldMap := map[string]string{
		"style":  "style",
		"genre":  "genre",
		"mood":   "mood",
		"scale":  "scale",
		"key":    "musical_key",
		"tempo":  "bpm",
		"bpm":    "bpm",
		"year":   "album.year", // Maps to the nested Album object
		"label":  "album.publisher",
		"artist": "artists.name", // Maps to the nested Artists array
	}

	for _, match := range matches {
		fullMatch := match[0]
		key := strings.ToLower(match[1])
		value := strings.Trim(match[2], `"`)

		// Escape single quotes to prevent Meilisearch syntax errors (e.g. artist:"D'Angelo")
		value = strings.ReplaceAll(value, "'", "\\'")

		// Remove the parsed filter from the text search query
		cleanQuery = strings.Replace(cleanQuery, fullMatch, "", 1)

		if mappedKey, ok := fieldMap[key]; ok {
			// If it's a numeric field, don't wrap it in quotes
			if _, err := strconv.ParseFloat(value, 64); err == nil && (key == "tempo" || key == "bpm") {
				filterStr += fmt.Sprintf(" AND %s = %s", mappedKey, value)
			} else {
				filterStr += fmt.Sprintf(" AND %s = '%s'", mappedKey, value)
			}
		}
	}

	// Clean up double spaces left behind by the regex replacement
	cleanQuery = strings.Join(strings.Fields(cleanQuery), " ")

	return cleanQuery, filterStr
}
