package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/meilisearch/meilisearch-go"
	"go.uber.org/zap"

	"momo-radio/internal/logger"
)

type SearchHandler struct {
	meili meilisearch.ServiceManager
}

func NewSearchHandler(meili meilisearch.ServiceManager) *SearchHandler {
	return &SearchHandler{meili: meili}
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
		zap.String("org_id", orgID.String()),
	)

	// 1. Always enforce tenant isolation
	baseFilter := fmt.Sprintf("organization_id = \"%s\"", orgID.String())
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

	c.JSON(http.StatusOK, gin.H{
		"hits":                 searchRes.Hits,
		"estimated_total_hits": searchRes.EstimatedTotalHits,
		"query":                c.Query("q"), // Return original query so UI state doesn't break
	})
}
