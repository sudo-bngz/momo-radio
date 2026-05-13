package handlers

import (
	"log/slog"
	"momo-radio/internal/models"
	"momo-radio/internal/storage"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// AlbumHandler handles album-related requests
type AlbumHandler struct {
	db      *gorm.DB
	storage *storage.Client // Keep storage in case you add album cover art later!
}

// NewAlbumHandler creates a new AlbumHandler instance with its required dependencies
func NewAlbumHandler(db *gorm.DB) *AlbumHandler {
	return &AlbumHandler{
		db: db,
	}
}

// LibraryAlbum provides a lightweight payload for browsing releases.
type LibraryAlbum struct {
	ID             uint   `json:"id"`
	Title          string `json:"title"`
	ArtistName     string `json:"artist_name"`
	Year           string `json:"year"`
	ReleaseCountry string `json:"release_country"`
}

// --- ALBUM ENDPOINTS ---

// GetAlbums returns a list of all albums scoped by Tenant
func (h *AlbumHandler) GetAlbums(c *gin.Context) {
	// 1. Extract Tenant ID using the helper from track.go
	orgID, ok := getOrgID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Organization context missing"})
		return
	}

	var albums []models.Album

	// ⚡️ 2. Scope to Tenant
	if err := h.db.Preload("Artist").Where("organization_id = ?", orgID).Order("title ASC").Find(&albums).Error; err != nil {
		slog.Error("Failed to fetch albums", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	c.JSON(http.StatusOK, albums)
}

// GetAlbumByID returns an album, its artist, and its tracklist scoped by Tenant
func (h *AlbumHandler) GetAlbumByID(c *gin.Context) {
	// ⚡️ 1. Extract Tenant ID
	orgID, ok := getOrgID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Organization context missing"})
		return
	}

	albumID := c.Param("id")
	var album models.Album

	// 2. Scope to Tenant
	err := h.db.
		Preload("Artist").
		Preload("Tracks").
		Where("organization_id = ?", orgID).
		First(&album, albumID).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Album not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	c.JSON(http.StatusOK, album)
}
