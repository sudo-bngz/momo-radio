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
	// ⚡️ 1. Extract Tenant ID
	orgID, ok := getOrgID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Organization context missing"})
		return
	}

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
	// 2. Verify the Playlist actually belongs to this Tenant!
	if err := h.db.Where("id = ? AND organization_id = ?", input.PlaylistID, orgID).First(&playlist).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Playlist not found or unauthorized"})
		return
	}

	loc, err := time.LoadLocation(h.cfg.Server.Timezone)
	if err != nil {
		log.Printf("Could not load timezone '%s', falling back to Local: %v", h.cfg.Server.Timezone, err)
		loc = time.Local
	}

	var localTime time.Time

	// Scenario A: Frontend sends strict UTC/Offset string (e.g., "2026-04-23T13:45:00Z")
	if len(input.StartTime) > 19 && (input.StartTime[len(input.StartTime)-1] == 'Z' || input.StartTime[len(input.StartTime)-6] == '+') {
		parsedTime, err := time.Parse(time.RFC3339, input.StartTime)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid RFC3339 time format"})
			return
		}
		localTime = parsedTime.In(loc)

		// Scenario B: Frontend sends exact local wall-clock (e.g., "2026-04-23T15:45")
	} else {
		layout := "2006-01-02T15:04"
		if len(input.StartTime) == 19 {
			layout = "2006-01-02T15:04:05" // If seconds are included
		}

		parsedTime, err := time.ParseInLocation(layout, input.StartTime[:len(layout)], loc)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid local time format"})
			return
		}
		localTime = parsedTime
	}

	exactDate := localTime.Format("2006-01-02")
	dayOfWeek := localTime.Weekday().String()[0:3]
	startTimeStr := localTime.Format("15:04")

	parsedEnd := localTime.Add(time.Duration(playlist.TotalDuration) * time.Second)
	endTimeStr := parsedEnd.Format("15:04")

	slot := models.ScheduleSlot{
		OrganizationID: orgID, // 3. Bind the Slot to the Tenant
		PlaylistID:     &input.PlaylistID,
		ScheduleType:   input.ScheduleType,
		Date:           exactDate,
		Days:           dayOfWeek,
		StartTime:      startTimeStr,
		EndTime:        endTimeStr,
		IsActive:       true,
	}

	if err := h.db.Create(&slot).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save schedule"})
		return
	}

	c.JSON(http.StatusCreated, slot)
}

func (h *SchedulerHandler) GetSchedule(c *gin.Context) {
	// ⚡️ Extract Tenant ID
	orgID, ok := getOrgID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Organization context missing"})
		return
	}

	var slots []models.ScheduleSlot
	// ⚡️ Scope to Tenant
	if err := h.db.Preload("Playlist").Where("organization_id = ? AND is_active = ?", orgID, true).Find(&slots).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch schedule"})
		return
	}

	c.JSON(http.StatusOK, slots)
}

func (h *SchedulerHandler) DeleteScheduleSlot(c *gin.Context) {
	// ⚡️ Extract Tenant ID
	orgID, ok := getOrgID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Organization context missing"})
		return
	}

	idStr := c.Param("id")
	slotID, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	// ⚡️ Verify ownership before deleting
	result := h.db.Where("id = ? AND organization_id = ?", slotID, orgID).Delete(&models.ScheduleSlot{})

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error during deletion"})
		return
	}

	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Slot not found or unauthorized"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Slot removed", "id": slotID})
}
