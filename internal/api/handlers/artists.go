package handlers

import (
	"log/slog"
	"net/http"

	"momo-radio/internal/models"
	"momo-radio/internal/storage"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ArtistHandler handles artist-related requests
type ArtistHandler struct {
	db      *gorm.DB
	storage *storage.Client // ⚡️ ADDED: Storage client to generate public URLs
}

// NewArtistHandler creates a new ArtistHandler instance with its required dependencies
func NewArtistHandler(db *gorm.DB, st *storage.Client) *ArtistHandler { // ⚡️ ADDED: Storage param
	return &ArtistHandler{
		db:      db,
		storage: st,
	}
}

// LibraryArtist prevents sending the full discography/bio over the network for list views.
type LibraryArtist struct {
	ID            uint   `json:"id"`
	Name          string `json:"name"`
	ArtistCountry string `json:"artist_country"`
	ImageURL      string `json:"image_url"` // ⚡️ ADDED: The fully qualified URL for the React frontend
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

	// ⚡️ 3. Map to DTO and generate Public URLs
	var response []LibraryArtist
	for _, a := range artists {
		var publicURL string

		// Note: Replace "AvatarKey" below if your models.Artist struct uses a different
		// field name for the image path (e.g., ImageKey, Picture, or CoverKey)
		if a.AvatarURL != "" {
			publicURL = h.storage.GetPublicURL(a.AvatarURL)
		}

		response = append(response, LibraryArtist{
			ID:            a.ID,
			Name:          a.Name,
			ArtistCountry: a.ArtistCountry,
			ImageURL:      publicURL,
		})
	}

	// Always return an empty array instead of null for React maps
	if response == nil {
		response = []LibraryArtist{}
	}

	c.JSON(http.StatusOK, response)
}

// GetArtistByName returns an artist and their full discography scoped by Tenant
func (h *ArtistHandler) GetArtistByName(c *gin.Context) {
	orgID, ok := getOrgID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Organization context missing"})
		return
	}

	artistName := c.Param("name")
	var artist models.Artist

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

	// ⚡️ Optional: If your React detail page also needs the public URL, you can
	// attach it dynamically using a Map before sending it back!
	var publicURL string
	if artist.AvatarURL != "" {
		publicURL = h.storage.GetPublicURL(artist.AvatarURL)
	}

	c.JSON(http.StatusOK, gin.H{
		"artist":    artist,
		"image_url": publicURL,
	})
}

// GetArtistByID returns an artist and their full discography scoped by Tenant
func (h *ArtistHandler) GetArtistByID(c *gin.Context) {
	orgID, ok := getOrgID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Organization missing"})
		return
	}

	artistID := c.Param("id")
	var artist models.Artist

	err := h.db.
		Preload("Tracks").
		Preload("Tracks.Album").
		Preload("Albums").
		Where("organization_id = ?", orgID).
		First(&artist, artistID).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Artist not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	// ⚡️ Same here: Attaching the public URL to the response payload
	var publicURL string
	if artist.AvatarURL != "" {
		publicURL = h.storage.GetPublicURL(artist.AvatarURL)
	}

	c.JSON(http.StatusOK, gin.H{
		"artist":    artist,
		"image_url": publicURL,
	})
}
