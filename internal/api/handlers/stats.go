package handlers

import (
	"net/http"
	"strings"
	"time"

	"momo-radio/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type StatsHandler struct {
	db *gorm.DB
}

func NewStatsHandler(db *gorm.DB) *StatsHandler {
	return &StatsHandler{db: db}
}

func (h *StatsHandler) GetStats(c *gin.Context) {
	// 1. Extract the Organization ID securely from the Gin Context
	orgIDRaw, exists := c.Get("organizationID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Organization context missing."})
		return
	}

	orgID, ok := orgIDRaw.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid organization ID format"})
		return
	}

	var totalTracks int64
	var totalPlaylists int64
	var storageUsed int64

	// 2. Apply the Tenant Scope to ALL basic aggregates
	h.db.Model(&models.Track{}).Where("organization_id = ?", orgID).Count(&totalTracks)
	h.db.Model(&models.Playlist{}).Where("organization_id = ?", orgID).Count(&totalPlaylists)
	h.db.Model(&models.Track{}).Where("organization_id = ?", orgID).Select("COALESCE(SUM(file_size), 0)").Scan(&storageUsed)

	// 3. Determine Active Schedule (The "Show")
	now := time.Now()
	currentTimeStr := now.Format("15:04")
	currentWeekday := now.Weekday().String()[0:3]

	var schedules []models.Schedule
	h.db.Preload("Playlist").Preload("RuleSet").Where("organization_id = ? AND is_active = ?", orgID, true).Find(&schedules)

	activeShowName := "General Rotation"
	for _, slot := range schedules {
		if strings.Contains(slot.Days, currentWeekday) && isTimeMatch(slot.StartTime, slot.EndTime, currentTimeStr) {
			activeShowName = slot.Name
			break
		}
	}

	// 4. Determine Currently Playing Track
	var streamState models.StreamState
	var currentTrack models.Track

	// Filter stream state by Tenant
	if err := h.db.Where("organization_id = ?", orgID).Order("updated_at DESC").First(&streamState).Error; err == nil {
		// ⚡️ FIXED: Using Find() into a slice prevents the "record not found" log spam for deleted tracks
		var foundTracks []models.Track
		h.db.Preload("Artists").Preload("Album").
			Where("organization_id = ? AND id = ?", orgID, streamState.TrackID).
			Limit(1).
			Find(&foundTracks)

		if len(foundTracks) > 0 {
			currentTrack = foundTracks[0]
		}
	}

	// ⚡️ Format the multiple artists into a single string for the Dashboard UI
	var artistNames []string
	for _, a := range currentTrack.Artists {
		artistNames = append(artistNames, a.Name)
	}
	artistStr := "Unknown Artist"
	if len(artistNames) > 0 {
		artistStr = strings.Join(artistNames, ", ")
	}

	// 5. Fetch Recent Tracks (History)
	var recentTracks []models.Track
	h.db.Model(&models.Track{}).
		Preload("Artists").
		Joins("JOIN play_histories ON play_histories.track_id = tracks.id").
		Where("tracks.organization_id = ?", orgID). // Filter history by Tenant
		Order("play_histories.played_at DESC").
		Limit(5).
		Find(&recentTracks)

	// 6. Build Response
	c.JSON(http.StatusOK, gin.H{
		"stats": gin.H{
			"total_tracks":       totalTracks,
			"total_playlists":    totalPlaylists,
			"storage_used_bytes": storageUsed,
			"uptime":             "99.9%",
		},
		"now_playing": gin.H{
			"title":         currentTrack.Title,
			"artist":        artistStr,
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
