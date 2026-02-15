package api

import (
	"momo-radio/internal/models"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

func (s *Server) GetStats(c *gin.Context) {
	var totalTracks int64
	var totalPlaylists int64
	var storageUsed int64

	// 1. Basic Aggregates
	s.db.DB.Model(&models.Track{}).Count(&totalTracks)
	s.db.DB.Model(&models.Playlist{}).Count(&totalPlaylists)
	s.db.DB.Model(&models.Track{}).Select("SUM(file_size)").Scan(&storageUsed)

	// 2. Determine Active Schedule (The "Show")
	now := time.Now()
	currentTimeStr := now.Format("15:04")
	currentWeekday := now.Weekday().String()[0:3]

	var schedules []models.Schedule
	s.db.DB.Preload("Playlist").Preload("RuleSet").Where("is_active = ?", true).Find(&schedules)

	activeShowName := "General Rotation"
	for _, slot := range schedules {
		if strings.Contains(slot.Days, currentWeekday) && isTimeMatch(slot.StartTime, slot.EndTime, currentTimeStr) {
			activeShowName = slot.Name
			break
		}
	}

	// 3. Determine Currently Playing Track (The "Song")
	// We pull this from the stream_state table which the Engine updates every time a song starts
	var streamState models.StreamState
	var currentTrack models.Track

	// We get the most recent state record
	if err := s.db.DB.Order("updated_at DESC").First(&streamState).Error; err == nil {
		s.db.DB.First(&currentTrack, streamState.TrackID)
	}

	// 4. Fetch Recent Tracks (History)
	var recentTracks []models.Track
	s.db.DB.Table("tracks").
		Joins("JOIN play_histories ON play_histories.track_id = tracks.id").
		Order("play_histories.played_at DESC").
		Limit(5).
		Find(&recentTracks)

	// 5. Build Response
	c.JSON(http.StatusOK, gin.H{
		"stats": gin.H{
			"total_tracks":       totalTracks,
			"total_playlists":    totalPlaylists,
			"storage_used_bytes": storageUsed,
			"uptime":             "99.9%", // You can calculate real uptime if stored
		},
		"now_playing": gin.H{
			"title":         currentTrack.Title,
			"artist":        currentTrack.Artist,
			"playlist_name": activeShowName,
			"starts_at":     streamState.UpdatedAt, // When this specific track started
			"ends_at":       streamState.UpdatedAt.Add(time.Duration(currentTrack.Duration) * time.Second),
		},
		"recent_tracks": recentTracks,
	})
}

// Internal helper for time matching (Standard vs Midnight Crossover)
func isTimeMatch(start, end, current string) bool {
	if start == "" || end == "" {
		return false
	}
	if start <= end {
		return current >= start && current < end
	}
	return current >= start || current < end
}
