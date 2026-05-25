package handlers

import (
	"log/slog"
	"net/http"
	"strconv"

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

// GetArtistByID handles fetching an artist by either numeric ID or Name
func (h *ArtistHandler) GetArtistByID(c *gin.Context) {
	orgID, ok := getOrgID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Organization missing"})
		return
	}

	param := c.Param("id") // Could be "72" or "Lady Gaga"
	var artist models.Artist

	// 1. Build the base query with preloads
	query := h.db.
		Preload("Tracks").
		Preload("Tracks.Album").
		Preload("Albums").
		Where("organization_id = ?", orgID)

	// ⚡️ 2. Smart Detection: Is it an ID or a Name?
	if id, err := strconv.Atoi(param); err == nil {
		// It's a number, search by ID
		query = query.Where("id = ?", id)
	} else {
		// It's a string, search by Name safely
		query = query.Where("name = ?", param)
	}

	// 3. Execute the safe query (Notice we removed 'param' from First())
	if err := query.First(&artist).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Artist not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	// 4. Attach Public URL
	// 1. Attach Public URL for the Artist Avatar
	var publicURL string
	if artist.AvatarURL != "" { // (Use whatever your model uses: ImageKey/AvatarKey)
		publicURL = h.storage.GetPublicURL(artist.AvatarURL)
	}

	// Loop through the albums and generate their Public URLs!
	var formattedAlbums []map[string]any
	for _, a := range artist.Albums {
		albumCoverURL := ""
		if a.CoverKey != "" {
			albumCoverURL = h.storage.GetPublicURL(a.CoverKey)
		}

		formattedAlbums = append(formattedAlbums, map[string]interface{}{
			"id":        a.ID,
			"title":     a.Title,
			"year":      a.Year,
			"cover_url": albumCoverURL, // Perfectly formatted for React
		})
	}

	// 3. Send it all back
	c.JSON(http.StatusOK, gin.H{
		"artist":    artist,
		"image_url": publicURL,
		"albums":    formattedAlbums, // ⚡️ Pass the formatted albums here!
	})
}
