package api

import (
	"momo-radio/internal/models"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

func (s *Server) CreateScheduleSlot(c *gin.Context) {
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
	if err := s.db.DB.First(&playlist, input.PlaylistID).Error; err != nil {
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

	if err := s.db.DB.Create(&slot).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Overlap or DB error"})
		return
	}

	c.JSON(http.StatusCreated, slot)
}

func (s *Server) GetSchedule(c *gin.Context) {
	start := c.Query("start") // e.g. 2026-02-01
	end := c.Query("end")     // e.g. 2026-02-08

	var slots []models.ScheduleSlot
	s.db.DB.Preload("Playlist").
		Where("start_time >= ? AND start_time <= ?", start, end).
		Find(&slots)

	c.JSON(http.StatusOK, slots)
}

func (s *Server) DeleteScheduleSlot(c *gin.Context) {
	// 1. Convert the ID from string to uint
	idStr := c.Param("id")
	slotID, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid schedule slot ID"})
		return
	}

	// 2. Perform the Soft Delete
	// We use an empty model with the ID to tell GORM which record to "delete"
	result := s.db.DB.Delete(&models.ScheduleSlot{}, uint(slotID))

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
