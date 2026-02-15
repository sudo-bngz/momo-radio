package handlers

import (
	"net/http"
	"strconv"
	"time"

	"momo-radio/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// SchedulerHandler handles scheduling-related requests independently of the main server
type SchedulerHandler struct {
	db *gorm.DB
}

// NewSchedulerHandler creates a new SchedulerHandler instance
func NewSchedulerHandler(db *gorm.DB) *SchedulerHandler {
	return &SchedulerHandler{db: db}
}

// CreateScheduleSlot creates a new broadcasting time slot
func (h *SchedulerHandler) CreateScheduleSlot(c *gin.Context) {
	var input struct {
		PlaylistID uint      `json:"playlist_id" binding:"required"`
		StartTime  time.Time `json:"start_time" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 1. Fetch playlist to get duration
	var playlist models.Playlist
	if err := h.db.First(&playlist, input.PlaylistID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Playlist not found"})
		return
	}

	// 2. Calculate EndTime
	endTime := input.StartTime.Add(time.Duration(playlist.TotalDuration) * time.Second)

	// 3. Create Slot
	slot := models.ScheduleSlot{
		PlaylistID: input.PlaylistID,
		StartTime:  input.StartTime,
		EndTime:    endTime,
	}

	if err := h.db.Create(&slot).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Overlap or DB error"})
		return
	}

	c.JSON(http.StatusCreated, slot)
}

// GetSchedule fetches schedule slots within a given date range
func (h *SchedulerHandler) GetSchedule(c *gin.Context) {
	start := c.Query("start") // e.g. 2026-02-01
	end := c.Query("end")     // e.g. 2026-02-08

	var slots []models.ScheduleSlot
	h.db.Preload("Playlist").
		Where("start_time >= ? AND start_time <= ?", start, end).
		Find(&slots)

	c.JSON(http.StatusOK, slots)
}

// DeleteScheduleSlot removes a time slot from the schedule
func (h *SchedulerHandler) DeleteScheduleSlot(c *gin.Context) {
	// 1. Convert the ID from string to uint
	idStr := c.Param("id")
	slotID, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid schedule slot ID"})
		return
	}

	// 2. Perform the Soft Delete
	result := h.db.Delete(&models.ScheduleSlot{}, uint(slotID))

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove slot from schedule"})
		return
	}

	// 3. Check if any row was actually affected
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Schedule slot not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Slot successfully removed from schedule",
		"id":      slotID,
	})
}
