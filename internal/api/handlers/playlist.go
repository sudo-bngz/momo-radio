package handlers

import (
	"net/http"
	"strconv"

	"momo-radio/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// PlaylistHandler handles playlist-related requests independently of the main server
type PlaylistHandler struct {
	db *gorm.DB
}

// NewPlaylistHandler creates a new PlaylistHandler instance
func NewPlaylistHandler(db *gorm.DB) *PlaylistHandler {
	return &PlaylistHandler{db: db}
}

// CreatePlaylist creates a new empty playlist container
func (h *PlaylistHandler) CreatePlaylist(c *gin.Context) {
	var input struct {
		Name  string `json:"name" binding:"required"`
		Color string `json:"color"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	playlist := models.Playlist{
		Name:  input.Name,
		Color: input.Color,
	}

	// Replaced s.db.DB with h.db
	if err := h.db.Create(&playlist).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create playlist"})
		return
	}

	c.JSON(http.StatusCreated, playlist)
}

// GetPlaylists fetches all playlists
func (h *PlaylistHandler) GetPlaylists(c *gin.Context) {
	var playlists []models.Playlist

	// Replaced s.db.DB with h.db
	result := h.db.Order("name asc").Find(&playlists)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch playlists"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": playlists,
	})
}

// UpdatePlaylistTracks reorders and replaces tracks in a playlist
func (h *PlaylistHandler) UpdatePlaylistTracks(c *gin.Context) {
	idStr := c.Param("id")
	playlistID, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid playlist ID"})
		return
	}

	var input struct {
		TrackIDs []uint `json:"track_ids" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Track IDs"})
		return
	}

	// Declare totalDuration outside the transaction so we can return it at the end
	var totalDuration int

	// Replaced s.db.DB with h.db
	err = h.db.Transaction(func(tx *gorm.DB) error {
		// 1. Remove existing associations
		if err := tx.Where("playlist_id = ?", playlistID).Delete(&models.PlaylistTrack{}).Error; err != nil {
			return err
		}

		// 2. Insert new associations and calculate duration
		for i, trackID := range input.TrackIDs {
			assoc := models.PlaylistTrack{
				PlaylistID: uint(playlistID),
				TrackID:    trackID,
				SortOrder:  i,
			}
			if err := tx.Create(&assoc).Error; err != nil {
				return err
			}

			// Fetch track to get duration
			var t models.Track
			if err := tx.First(&t, trackID).Error; err != nil {
				return err
			}

			// Convert float64 to int for the total calculation
			totalDuration += int(t.Duration)
		}

		// 3. Update Playlist metadata
		return tx.Model(&models.Playlist{}).Where("id = ?", playlistID).Update("total_duration", totalDuration).Error
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Return the actual calculated duration instead of the word "calculated"
	c.JSON(http.StatusOK, gin.H{
		"status":         "success",
		"total_duration": totalDuration,
	})
}
