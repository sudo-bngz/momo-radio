package handlers

import (
	"log"
	"momo-radio/internal/config"
	"momo-radio/internal/models"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type SchedulerHandler struct {
	db  *gorm.DB
	cfg *config.Config
}

func NewSchedulerHandler(db *gorm.DB, cfg *config.Config) *SchedulerHandler {
	return &SchedulerHandler{db: db, cfg: cfg}
}

func (h *SchedulerHandler) CreateScheduleSlot(c *gin.Context) {
	var input struct {
		PlaylistID   uint   `json:"playlist_id" binding:"required"`
		StartTime    string `json:"start_time" binding:"required"`
		ScheduleType string `json:"schedule_type"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if input.ScheduleType == "" {
		input.ScheduleType = "one_time"
	}

	var playlist models.Playlist
	if err := h.db.First(&playlist, input.PlaylistID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Playlist not found"})
		return
	}

	parsedTime, err := time.Parse(time.RFC3339, input.StartTime)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid time format"})
		return
	}

	// --- DYNAMIC TIMEZONE LOGIC ---
	// Read the timezone from your Viper config instead of hardcoding it
	loc, err := time.LoadLocation(h.cfg.Server.Timezone)
	if err != nil {
		log.Printf("⚠️ Could not load timezone '%s', falling back to Local: %v", h.cfg.Server.Timezone, err)
		loc = time.Local
	}

	localTime := parsedTime.In(loc)
	// ------------------------------

	exactDate := localTime.Format("2006-01-02")
	dayOfWeek := localTime.Weekday().String()[0:3]
	startTimeStr := localTime.Format("15:04")

	parsedEnd := localTime.Add(time.Duration(playlist.TotalDuration) * time.Second)
	endTimeStr := parsedEnd.Format("15:04")

	slot := models.ScheduleSlot{
		PlaylistID:   &input.PlaylistID,
		ScheduleType: input.ScheduleType,
		Date:         exactDate,
		Days:         dayOfWeek,
		StartTime:    startTimeStr,
		EndTime:      endTimeStr,
		IsActive:     true,
	}

	if err := h.db.Create(&slot).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save schedule"})
		return
	}

	c.JSON(http.StatusCreated, slot)
}

// ... (GetSchedule and DeleteScheduleSlot remain exactly the same)
func (h *SchedulerHandler) GetSchedule(c *gin.Context) {
	// Return all slots so the React calendar can render both one-time and recurring events
	var slots []models.ScheduleSlot
	h.db.Preload("Playlist").Where("is_active = ?", true).Find(&slots)
	c.JSON(http.StatusOK, slots)
}

func (h *SchedulerHandler) DeleteScheduleSlot(c *gin.Context) {
	idStr := c.Param("id")
	slotID, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	result := h.db.Delete(&models.ScheduleSlot{}, uint(slotID))
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Slot not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Slot removed", "id": slotID})
}
