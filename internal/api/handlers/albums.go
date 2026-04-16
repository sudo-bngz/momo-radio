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

// ListAlbums returns a list of all albums
func (h *AlbumHandler) GetAlbums(c *gin.Context) {
	var albums []models.Album

	// Preload just the artist name so the UI knows who made the album
	if err := h.db.Preload("Artist").Order("title ASC").Find(&albums).Error; err != nil {
		slog.Error("Failed to fetch albums", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	c.JSON(http.StatusOK, albums)
}

// GetAlbumByID returns an album, its artist, and its tracklist
func (h *AlbumHandler) GetAlbumByID(c *gin.Context) {
	albumID := c.Param("id")

	var album models.Album

	err := h.db.
		Preload("Artist").
		Preload("Tracks").
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
