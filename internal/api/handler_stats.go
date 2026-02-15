package api

import (
	"momo-radio/internal/models"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// GetStats aggregates station data for the Dashboard
func (s *Server) GetStats(c *gin.Context) {
	var stats struct {
		TotalTracks      int64  `json:"total_tracks"`
		TotalPlaylists   int64  `json:"total_playlists"`
		StorageUsedBytes int64  `json:"storage_used_bytes"`
		Uptime           string `json:"uptime"`
	}

	now := time.Now()

	// 1. Calculate Counts and Storage
	// Assuming 'bitrate' or a 'file_size' column exists to estimate storage.
	// If you don't have file_size, we sum duration as a proxy or use 0.
	s.db.DB.Model(&models.Track{}).Count(&stats.TotalTracks)
	s.db.DB.Model(&models.Playlist{}).Count(&stats.TotalPlaylists)

	// Summing bitrate * duration as a rough storage estimate if file_size is missing,
	// otherwise replace "bitrate" with your actual file size column.
	s.db.DB.Model(&models.Track{}).Select("COALESCE(SUM(bitrate), 0)").Scan(&stats.StorageUsedBytes)

	stats.Uptime = "100%" // Placeholder for system health

	// 2. Fetch Recent Tracks
	var recentTracks []models.Track
	if err := s.db.DB.Order("created_at desc").Limit(5).Find(&recentTracks).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch recent tracks"})
		return
	}

	// 3. Logic for "Now Playing"
	// We look for a schedule slot where the current time falls between start and end.
	var nowPlaying struct {
		Title        string    `json:"title"`
		Artist       string    `json:"artist"`
		PlaylistName string    `json:"playlist_name"`
		StartsAt     time.Time `json:"starts_at"`
		EndsAt       time.Time `json:"ends_at"`
	}

	err := s.db.DB.Table("schedules").
		Select("tracks.title, tracks.artist, playlists.name as playlist_name, schedules.start_time as starts_at, schedules.end_time as ends_at").
		Joins("JOIN playlists ON playlists.id = schedules.playlist_id").
		Joins("JOIN playlist_tracks ON playlist_tracks.playlist_id = playlists.id").
		Joins("JOIN tracks ON tracks.id = playlist_tracks.track_id").
		Where("? BETWEEN schedules.start_time AND schedules.end_time", now).
		Order("playlist_tracks.sort_order ASC"). // Pick the first track in the sequence
		First(&nowPlaying).Error
	// Prepare the final response
	response := gin.H{
		"stats":         stats,
		"recent_tracks": recentTracks,
	}

	if err == nil {
		response["now_playing"] = nowPlaying
	} else {
		response["now_playing"] = nil
	}

	c.JSON(http.StatusOK, response)
}
