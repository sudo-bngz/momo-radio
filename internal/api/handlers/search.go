package handlers

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/meilisearch/meilisearch-go"
)

type SearchHandler struct {
	meili meilisearch.ServiceManager
}

func NewSearchHandler(meili meilisearch.ServiceManager) *SearchHandler {
	return &SearchHandler{meili: meili}
}

// SearchLibrary fetches tracks from the search engine scoped to the organization
func (h *SearchHandler) SearchLibrary(c *gin.Context) {
	orgID, ok := getOrgID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: missing organization context"})
		return
	}

	query := c.Query("q")
	limitStr := c.DefaultQuery("limit", "20")
	limit, _ := strconv.ParseInt(limitStr, 10, 64)

	filter := fmt.Sprintf("organization_id = '%s'", orgID.String())

	if scale := c.Query("scale"); scale != "" {
		filter += fmt.Sprintf(" AND scale = '%s'", scale)
	}
	if genre := c.Query("genre"); genre != "" {
		filter += fmt.Sprintf(" AND genre = '%s'", genre)
	}

	searchRes, err := h.meili.Index("tracks").Search(query, &meilisearch.SearchRequest{
		Filter: filter,
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
		"query":                query,
	})
}
