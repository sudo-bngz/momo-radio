package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/meilisearch/meilisearch-go"
	"go.uber.org/zap"

	"momo-radio/internal/logger"
	"momo-radio/internal/utils"
)

type SearchHandler struct {
	meili meilisearch.ServiceManager
	cdn   *utils.CDNBuilder
}

func NewSearchHandler(meili meilisearch.ServiceManager, cdn *utils.CDNBuilder) *SearchHandler {
	return &SearchHandler{
		meili: meili,
		cdn:   cdn,
	}
}

// SearchLibrary fetches tracks using Meilisearch's native filter expressions
func (h *SearchHandler) SearchLibrary(c *gin.Context) {
	orgID, ok := getOrgID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: missing organization context"})
		return
	}

	query := c.Query("q")
	limitStr := c.DefaultQuery("limit", "20")
	limit, _ := strconv.ParseInt(limitStr, 10, 64)

	logger.Log.Debug("Incoming search request",
		zap.String("raw_q", query),
		zap.String("raw_filter", c.Query("filter")),
		zap.String("org_id", fmt.Sprintf("%v", orgID)),
	)

	// 1. Always enforce tenant isolation
	baseFilter := fmt.Sprintf("organization_id = \"%v\"", orgID)
	finalFilter := baseFilter

	// 2. Intercept advanced syntax directly from the 'q' parameter
	lowerQuery := strings.ToLower(strings.TrimSpace(query))

	if strings.HasPrefix(lowerQuery, "tag:") {
		// --- TAG MODE ---
		tag := strings.TrimSpace(query[4:])
		safeTag := strings.ReplaceAll(tag, `"`, `\"`) // Escape quotes

		logger.Log.Debug("Tag mode detected", zap.String("parsed_tag", safeTag))

		attributes := []string{
			"genre", "style", "mood", "scale", "musical_key",
			"artists_names", "album_title", "year", "publisher",
		}

		var tagFilters []string
		for _, attr := range attributes {
			tagFilters = append(tagFilters, fmt.Sprintf("%s = \"%s\"", attr, safeTag))
		}

		finalFilter = fmt.Sprintf("%s AND (%s)", baseFilter, strings.Join(tagFilters, " OR "))
		query = "" // Clear text search so Meilisearch relies purely on the filter

	} else if strings.HasPrefix(lowerQuery, "filter:") {
		// --- RAW NATIVE FILTER MODE ---
		rawFilter := strings.TrimSpace(query[7:])

		logger.Log.Debug("Raw filter mode detected", zap.String("parsed_filter", rawFilter))

		if rawFilter != "" {
			finalFilter = fmt.Sprintf("%s AND (%s)", baseFilter, rawFilter)
		}
		query = "" // Clear text search

	} else {
		// --- LEGACY/EXPLICIT FILTER MODE ---
		userFilter := c.Query("filter")
		if userFilter != "" {
			finalFilter = fmt.Sprintf("%s AND (%s)", baseFilter, userFilter)
		}
	}

	logger.Log.Debug("Executing Meilisearch query",
		zap.String("final_q", query),
		zap.String("final_filter", finalFilter),
		zap.Int64("limit", limit),
	)

	// 3. Execute the search
	searchRes, err := h.meili.Index("tracks").Search(query, &meilisearch.SearchRequest{
		Filter: finalFilter,
		Limit:  limit,
	})

	if err != nil {
		if strings.Contains(err.Error(), "invalid_search_filter") {
			logger.Log.Debug("Incomplete filter syntax from user", zap.String("filter", finalFilter))

			// Gracefully return an empty result set instead of blowing up the app
			c.JSON(http.StatusOK, gin.H{
				"hits":                 []map[string]any{},
				"estimated_total_hits": 0,
				"query":                c.Query("q"),
			})
			return
		}

		logger.Log.Error("Meilisearch query failed",
			zap.Error(err),
			zap.String("query", query),
			zap.String("filter", finalFilter),
		)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to search library"})
		return
	}

	logger.Log.Debug("Meilisearch query successful",
		zap.Int64("estimated_total_hits", searchRes.EstimatedTotalHits),
		zap.Int("hits_returned", len(searchRes.Hits)),
	)

	var parsedHits []map[string]any
	hitsBytes, _ := json.Marshal(searchRes.Hits)
	json.Unmarshal(hitsBytes, &parsedHits)

	// Now we can safely iterate, assert standard strings, and safely stringify the UUID
	safeOrgID := fmt.Sprintf("%v", orgID)

	for i := range parsedHits {
		if cover, ok := parsedHits[i]["cover_url"].(string); ok && cover != "" {
			if !strings.HasPrefix(cover, "http") {
				parsedHits[i]["cover_url"] = h.cdn.BuildAssetURL(cover, safeOrgID)
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"hits":                 parsedHits, // ⚡️ Send our cleanly parsed hits instead
		"estimated_total_hits": searchRes.EstimatedTotalHits,
		"query":                c.Query("q"),
	})
}
