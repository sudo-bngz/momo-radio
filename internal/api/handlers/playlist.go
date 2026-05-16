package handlers

import (
	"net/http"
	"strconv"

	"momo-radio/internal/models"
	"momo-radio/internal/storage"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// PlaylistHandler handles playlist-related requests independently of the main server
type PlaylistHandler struct {
	db      *gorm.DB
	storage *storage.Client
}

// NewPlaylistHandler creates a new PlaylistHandler instance
func NewPlaylistHandler(db *gorm.DB, st *storage.Client) *PlaylistHandler {
	return &PlaylistHandler{db: db, storage: st}
}

// CreatePlaylist creates a new empty playlist container scoped to the Tenant
func (h *PlaylistHandler) CreatePlaylist(c *gin.Context) {
	// ⚡️ 1. Extract Tenant ID
	orgID, ok := getOrgID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Organization context missing"})
		return
	}

	var input struct {
		Name  string `json:"name" binding:"required"`
		Color string `json:"color"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	playlist := models.Playlist{
		OrganizationID: orgID, // ⚡️ 2. Bind the new playlist to the Tenant
		Name:           input.Name,
		Color:          input.Color,
	}

	if err := h.db.Create(&playlist).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create playlist"})
		return
	}

	c.JSON(http.StatusCreated, playlist)
}

func (h *PlaylistHandler) GetPlaylist(c *gin.Context) {
	orgID, ok := getOrgID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Organization context missing"})
		return
	}

	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid playlist ID"})
		return
	}

	var playlist models.Playlist

	// ⚡️ Scope to Tenant
	if err := h.db.Where("organization_id = ?", orgID).First(&playlist, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Playlist not found"})
		return
	}

	var orderedTracks []models.Track
	h.db.Joins("JOIN playlist_tracks ON playlist_tracks.track_id = tracks.id").
		Where("playlist_tracks.playlist_id = ?", id).
		Order("playlist_tracks.sort_order ASC").
		Preload("Artists"). // ⚡️ FIXED: Pluralized to match new Many2Many relation
		Preload("Album").
		Find(&orderedTracks)

	for i := range orderedTracks {
		if orderedTracks[i].Album.ID != 0 && orderedTracks[i].Album.CoverKey != "" {
			orderedTracks[i].Album.CoverURL = h.storage.GetPublicURL(orderedTracks[i].Album.CoverKey)
		}
	}
	playlist.Tracks = orderedTracks

	c.JSON(http.StatusOK, playlist)
}

// GetPlaylists fetches all playlists scoped to the Tenant
func (h *PlaylistHandler) GetPlaylists(c *gin.Context) {
	orgID, ok := getOrgID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Organization context missing"})
		return
	}

	var playlists []models.Playlist

	// ⚡️ Scope to Tenant
	result := h.db.
		Preload("Tracks").
		Preload("Tracks.Artists"). // ⚡️ FIXED: Pluralized to match new Many2Many relation
		Preload("Tracks.Album").
		Where("organization_id = ?", orgID).
		Order("name asc").
		Find(&playlists)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch playlists"})
		return
	}

	for i := range playlists {
		for j := range playlists[i].Tracks {
			if playlists[i].Tracks[j].Album.ID != 0 && playlists[i].Tracks[j].Album.CoverKey != "" {
				url := h.storage.GetPublicURL(playlists[i].Tracks[j].Album.CoverKey)
				if url != "" {
					playlists[i].Tracks[j].Album.CoverURL = url
				}
			}
		}
	}

	if playlists == nil {
		playlists = []models.Playlist{}
	}

	c.JSON(http.StatusOK, gin.H{
		"data": playlists,
	})
}

func (h *PlaylistHandler) UpdatePlaylist(c *gin.Context) {
	orgID, ok := getOrgID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Organization context missing"})
		return
	}

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

	if err := h.db.Where("organization_id = ?", orgID).First(&playlist, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Playlist not found"})
		return
	}

	if input.Name != "" {
		playlist.Name = input.Name
	}
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

// UpdatePlaylistTracks reorders and replaces tracks in a playlist safely
func (h *PlaylistHandler) UpdatePlaylistTracks(c *gin.Context) {
	orgID, ok := getOrgID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Organization context missing"})
		return
	}

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

	var playlist models.Playlist
	if err := h.db.Where("id = ? AND organization_id = ?", playlistID, orgID).First(&playlist).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Playlist not found"})
		return
	}

	var totalDuration int

	err = h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("playlist_id = ?", playlistID).Delete(&models.PlaylistTrack{}).Error; err != nil {
			return err
		}

		for i, trackID := range input.TrackIDs {
			var t models.Track
			if err := tx.Where("id = ? AND organization_id = ?", trackID, orgID).First(&t).Error; err != nil {
				return err
			}

			assoc := models.PlaylistTrack{
				PlaylistID: uint(playlistID),
				TrackID:    trackID,
				SortOrder:  i,
			}
			if err := tx.Create(&assoc).Error; err != nil {
				return err
			}

			totalDuration += int(t.Duration)
		}

		return tx.Model(&models.Playlist{}).Where("id = ?", playlistID).Update("total_duration", totalDuration).Error
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update tracks. Ensure all tracks belong to your station."})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":         "success",
		"total_duration": totalDuration,
	})
}

// DeletePlaylist removes a playlist and cleans up its track associations safely
func (h *PlaylistHandler) DeletePlaylist(c *gin.Context) {
	orgID, ok := getOrgID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Organization context missing"})
		return
	}

	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	var playlist models.Playlist
	if err := h.db.Where("id = ? AND organization_id = ?", id, orgID).First(&playlist).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Playlist not found"})
		return
	}

	err = h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("playlist_id = ?", id).Delete(&models.PlaylistTrack{}).Error; err != nil {
			return err
		}
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
