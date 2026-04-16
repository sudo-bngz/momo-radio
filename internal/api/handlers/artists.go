package handlers

import (
	"log/slog"
	"momo-radio/internal/models"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ArtistHandler handles artist-related requests
type ArtistHandler struct {
	db *gorm.DB
}

// NewArtistHandler creates a new ArtistHandler instance with its required dependencies
func NewArtistHandler(db *gorm.DB) *ArtistHandler {
	return &ArtistHandler{
		db: db,
	}
}

// LibraryArtist prevents sending the full discography/bio over the network for list views.
type LibraryArtist struct {
	ID            uint   `json:"id"`
	Name          string `json:"name"`
	ArtistCountry string `json:"artist_country"`
}

// ListArtists returns a list of all artists
func (h *ArtistHandler) GetArtists(c *gin.Context) {
	var artists []models.Artist

	// Only load the artists, don't preload tracks here to keep the payload light
	if err := h.db.Order("name ASC").Find(&artists).Error; err != nil {
		slog.Error("Failed to fetch artists", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	c.JSON(http.StatusOK, artists)
}

// GetArtistByName returns an artist and their full discography
func (h *ArtistHandler) GetArtistByName(c *gin.Context) {
	artistName := c.Param("name")

	var artist models.Artist

	err := h.db.
		Preload("Albums").
		Preload("Tracks").
		Where("name = ?", artistName).
		First(&artist).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Artist not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	c.JSON(http.StatusOK, artist)
}
