package api

import (
	"momo-radio/internal/models"
	"net/http"
	"strconv" // Required for string conversion

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// CreatePlaylist creates a new empty playlist container
func (s *Server) CreatePlaylist(c *gin.Context) {
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

	if err := s.db.DB.Create(&playlist).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create playlist"})
		return
	}

	c.JSON(http.StatusCreated, playlist)
}

func (s *Server) GetPlaylists(c *gin.Context) {
	var playlists []models.Playlist

	// We use Preload("Tracks") if you want the full track data,
	// or just fetch the playlists if you only need names and durations.
	result := s.db.DB.Order("name asc").Find(&playlists)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch playlists"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": playlists,
	})
}

// UpdatePlaylistTracks reorders and replaces tracks in a playlist
func (s *Server) UpdatePlaylistTracks(c *gin.Context) {
	// FIX 1: Convert string ID from URL to uint
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

	err = s.db.DB.Transaction(func(tx *gorm.DB) error {
		// 1. Remove existing associations
		if err := tx.Where("playlist_id = ?", playlistID).Delete(&models.PlaylistTrack{}).Error; err != nil {
			return err
		}

		// 2. Insert new associations and calculate duration
		var totalDuration int
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

			// FIX 2: Convert float64 to int for the total calculation
			// We assume Duration in models.Track is float64 (seconds)
			totalDuration += int(t.Duration)
		}

		// 3. Update Playlist metadata
		return tx.Model(&models.Playlist{}).Where("id = ?", playlistID).Update("total_duration", totalDuration).Error
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "total_duration": "calculated"})
}
