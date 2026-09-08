package handlers

import (
	"net/http"
	"strings"
	"time"

	"momo-radio/internal/models"
	"momo-radio/internal/utils" // ⚡️ ADDED: Import utils for CDNBuilder

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type StatsHandler struct {
	db  *gorm.DB
	cdn *utils.CDNBuilder // ⚡️ ADDED: CDN injection
}

func NewStatsHandler(db *gorm.DB, cdn *utils.CDNBuilder) *StatsHandler {
	return &StatsHandler{
		db:  db,
		cdn: cdn,
	}
}

func (h *StatsHandler) GetStats(c *gin.Context) {
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

	h.db.Model(&models.Track{}).Where("organization_id = ?", orgID).Count(&totalTracks)
	h.db.Model(&models.Playlist{}).Where("organization_id = ?", orgID).Count(&totalPlaylists)
	h.db.Model(&models.Track{}).Where("organization_id = ?", orgID).Select("COALESCE(SUM(file_size), 0)").Scan(&storageUsed)

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

	var streamState models.StreamState
	var currentTrack models.Track
	var startsAt time.Time

	if err := h.db.Where("organization_id = ?", orgID).Order("updated_at DESC").First(&streamState).Error; err == nil {
		var foundTracks []models.Track
		h.db.Preload("Artists").Preload("Album").
			Where("organization_id = ? AND id = ?", orgID, streamState.TrackID).
			Limit(1).
			Find(&foundTracks)

		if len(foundTracks) > 0 {
			currentTrack = foundTracks[0]

			var playedAt time.Time
			h.db.Table("play_histories").
				Select("played_at").
				Where("track_id = ?", currentTrack.ID).
				Order("played_at DESC").
				Limit(1).
				Scan(&playedAt)

			if !playedAt.IsZero() {
				startsAt = playedAt
			} else {
				startsAt = streamState.UpdatedAt
			}
		}
	}

	var artistNames []string
	for _, a := range currentTrack.Artists {
		artistNames = append(artistNames, a.Name)
	}
	artistStr := "Unknown Artist"
	if len(artistNames) > 0 {
		artistStr = strings.Join(artistNames, ", ")
	}

	durationMs := int64(currentTrack.Duration * 1000)

	var endsAt time.Time
	var elapsedMs int64

	if !startsAt.IsZero() {
		endsAt = startsAt.Add(time.Duration(currentTrack.Duration) * time.Second)
		elapsedMs = time.Since(startsAt).Milliseconds()
	}

	if elapsedMs < 0 {
		elapsedMs = 0
	}
	if durationMs > 0 && elapsedMs > durationMs {
		elapsedMs = durationMs
	}

	var waveformURL string
	if currentTrack.WaveformKey != "" {
		// Note: Adjust "BuildAssetURL" to whatever method you named it in utils.CDNBuilder
		waveformURL = h.cdn.BuildAssetURL(currentTrack.WaveformKey, orgID.String())
	}

	var coverURL string
	if currentTrack.Album.CoverKey != "" {
		coverURL = h.cdn.BuildAssetURL(currentTrack.Album.CoverKey, orgID.String())
	}

	var recentTracks []models.Track
	h.db.Model(&models.Track{}).
		Preload("Artists").
		Joins("JOIN play_histories ON play_histories.track_id = tracks.id").
		Where("tracks.organization_id = ?", orgID).
		Order("play_histories.played_at DESC").
		Limit(5).
		Find(&recentTracks)

	c.JSON(http.StatusOK, gin.H{
		"stats": gin.H{
			"total_tracks":       totalTracks,
			"total_playlists":    totalPlaylists,
			"storage_used_bytes": storageUsed,
			"uptime":             "99.9%",
		},
		"now_playing": gin.H{
			"track_id":      currentTrack.ID,
			"cover_url":     coverURL,
			"waveform_url":  waveformURL,
			"title":         currentTrack.Title,
			"artist":        artistStr,
			"playlist_name": activeShowName,
			"starts_at":     startsAt,
			"ends_at":       endsAt,
			"elapsed_ms":    elapsedMs,
			"duration_ms":   durationMs,
		},
		"recent_tracks": recentTracks,
	})
}

func isTimeMatch(start, end, current string) bool {
	if start == "" || end == "" {
		return false
	}
	if start <= end {
		return current >= start && current < end
	}
	return current >= start || current < end
}
