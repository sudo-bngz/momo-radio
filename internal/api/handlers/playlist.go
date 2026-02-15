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

func (h *PlaylistHandler) GetPlaylist(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid playlist ID"})
		return
	}

	var playlist models.Playlist
	// Preload("Tracks") is essential so the Playlist Studio shows the current songs
	if err := h.db.Preload("Tracks").First(&playlist, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Playlist not found"})
		return
	}

	c.JSON(http.StatusOK, playlist)
}

// GetPlaylists fetches all playlists
func (h *PlaylistHandler) GetPlaylists(c *gin.Context) {
	var playlists []models.Playlist

	// Replaced s.db.DB with h.db
	result := h.db.Preload("Tracks").Order("name asc").Find(&playlists)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch playlists"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": playlists,
	})
}

func (h *PlaylistHandler) UpdatePlaylist(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid playlist ID"})
		return
	}

	var input struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		Color       string `json:"color"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var playlist models.Playlist
	if err := h.db.First(&playlist, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Playlist not found"})
		return
	}

	// Update fields if they were provided in the JSON payload
	if input.Name != "" {
		playlist.Name = input.Name
	}
	// We always update the description (even if empty string) so users can clear it
	playlist.Description = input.Description

	if input.Color != "" {
		playlist.Color = input.Color
	}

	if err := h.db.Save(&playlist).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update playlist metadata"})
		return
	}

	c.JSON(http.StatusOK, playlist)
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

// DeletePlaylist removes a playlist and cleans up its track associations
func (h *PlaylistHandler) DeletePlaylist(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	// Use a transaction to ensure we delete the playlist and its associations cleanly
	err = h.db.Transaction(func(tx *gorm.DB) error {
		// 1. Delete the associations in the join table first
		if err := tx.Where("playlist_id = ?", id).Delete(&models.PlaylistTrack{}).Error; err != nil {
			return err
		}

		// 2. Delete the playlist itself
		if err := tx.Delete(&models.Playlist{}, id).Error; err != nil {
			return err
		}
		return nil
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete playlist"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Playlist deleted successfully"})
}
