package api

import (
	"momo-radio/internal/models"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// GetTracks returns a paginated list of tracks from the database
// Query Params: page (default 1), limit (default 50), search (optional)
func (s *Server) GetTracks(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	search := c.Query("search")

	offset := (page - 1) * limit

	var tracks []models.Track
	var total int64

	query := s.db.DB.Model(&models.Track{})

	if search != "" {
		// Basic search on artist or title
		searchTerm := "%" + search + "%"
		query = query.Where("artist ILIKE ? OR title ILIKE ?", searchTerm, searchTerm)
	}

	// Count total for pagination metadata
	query.Count(&total)

	// Fetch data
	result := query.Order("created_at desc").Limit(limit).Offset(offset).Find(&tracks)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": tracks,
		"meta": gin.H{
			"page":  page,
			"limit": limit,
			"total": total,
		},
	})
}

// GetStats returns basic database statistics
func (s *Server) GetStats(c *gin.Context) {
	var trackCount int64
	var distinctArtists int64

	s.db.DB.Model(&models.Track{}).Count(&trackCount)
	s.db.DB.Model(&models.Track{}).Distinct("artist").Count(&distinctArtists)

	c.JSON(http.StatusOK, gin.H{
		"total_tracks":   trackCount,
		"unique_artists": distinctArtists,
	})
}
