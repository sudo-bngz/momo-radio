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

// --- ARTIST ENDPOINTS ---

// GetArtists returns a list of all artists scoped by Tenant
func (h *ArtistHandler) GetArtists(c *gin.Context) {
	// 1. Extract Tenant ID
	orgID, ok := getOrgID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Organization context missing"})
		return
	}

	var artists []models.Artist

	// 2. Scope to Tenant
	if err := h.db.Where("organization_id = ?", orgID).Order("name ASC").Find(&artists).Error; err != nil {
		slog.Error("Failed to fetch artists", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	c.JSON(http.StatusOK, artists)
}

// GetArtistByName returns an artist and their full discography scoped by Tenant
func (h *ArtistHandler) GetArtistByName(c *gin.Context) {
	// ⚡️ 1. Extract Tenant ID
	orgID, ok := getOrgID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Organization context missing"})
		return
	}

	artistName := c.Param("name")
	var artist models.Artist

	// 2. Scope to Tenant
	err := h.db.
		Preload("Albums").
		Preload("Tracks").
		Where("name = ? AND organization_id = ?", artistName, orgID).
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
