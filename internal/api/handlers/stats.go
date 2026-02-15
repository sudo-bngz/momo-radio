package handlers

import (
	"net/http"
	"strings"
	"time"

	"momo-radio/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// StatsHandler handles stats-related requests independently of the main server
type StatsHandler struct {
	db *gorm.DB
}

// NewStatsHandler creates a new StatsHandler instance
func NewStatsHandler(db *gorm.DB) *StatsHandler {
	return &StatsHandler{db: db}
}

// GetStats returns aggregated dashboard statistics and currently playing data
func (h *StatsHandler) GetStats(c *gin.Context) {
	var totalTracks int64
	var totalPlaylists int64
	var storageUsed int64 // Fixed the 'int64a' typo

	// 1. Basic Aggregates (using h.db instead of s.db.DB)
	h.db.Model(&models.Track{}).Count(&totalTracks)
	h.db.Model(&models.Playlist{}).Count(&totalPlaylists)
	h.db.Model(&models.Track{}).Select("COALESCE(SUM(file_size), 0)").Scan(&storageUsed)

	// 2. Determine Active Schedule (The "Show")
	now := time.Now()
	currentTimeStr := now.Format("15:04")
	currentWeekday := now.Weekday().String()[0:3]

	var schedules []models.Schedule
	h.db.Preload("Playlist").Preload("RuleSet").Where("is_active = ?", true).Find(&schedules)

	activeShowName := "General Rotation"
	for _, slot := range schedules {
		if strings.Contains(slot.Days, currentWeekday) && isTimeMatch(slot.StartTime, slot.EndTime, currentTimeStr) {
			activeShowName = slot.Name
			break
		}
	}

	// 3. Determine Currently Playing Track (The "Song")
	var streamState models.StreamState
	var currentTrack models.Track

	// We get the most recent state record
	if err := h.db.Order("updated_at DESC").First(&streamState).Error; err == nil {
		h.db.First(&currentTrack, streamState.TrackID)
	}

	// 4. Fetch Recent Tracks (History)
	var recentTracks []models.Track
	h.db.Table("tracks").
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
			"uptime":             "99.9%",
		},
		"now_playing": gin.H{
			"title":         currentTrack.Title,
			"artist":        currentTrack.Artist,
			"playlist_name": activeShowName,
			"starts_at":     streamState.UpdatedAt,
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
