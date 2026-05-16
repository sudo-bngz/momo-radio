package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/hibiken/asynq"

	"momo-radio/internal/export"
)

type ExportHandler struct {
	asynqClient *asynq.Client
}

func NewExportHandler(client *asynq.Client) *ExportHandler {
	return &ExportHandler{
		asynqClient: client,
	}
}

// ExportToM3u triggers the backend processing job to package a tenant playlist
func (h *ExportHandler) ExportToM3u(c *gin.Context) {
	idStr := c.Param("id")
	playlistID, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid playlist ID"})
		return
	}

	orgIDRaw, exists := c.Get("organizationID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Organization context missing"})
		return
	}
	orgID, ok := orgIDRaw.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid organization ID format"})
		return
	}

	rawUserID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized user context"})
		return
	}

	var userID uint
	// JWT parses JSON numbers as float64, so we must safely convert it
	switch v := rawUserID.(type) {
	case float64:
		userID = uint(v)
	case string:
		parsed, err := strconv.ParseUint(v, 10, 32)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID format in token"})
			return
		}
		userID = uint(parsed)
	case uint:
		userID = v
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse user ID from token"})
		return
	}

	// 1. Construct the payload matching our new worker definitions
	payload := export.PlaylistExportPayload{
		PlaylistID:     uint(playlistID),
		UserID:         userID,
		OrganizationID: orgID.String(), // ⚡️ Passed to secure worker query
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to serialize task payload"})
		return
	}

	// 2. Enqueue the Asynq task using the updated M3U type constants
	task := asynq.NewTask(export.TypeExportPlaylist, payloadBytes)
	info, err := h.asynqClient.Enqueue(task, asynq.Queue("exports"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to enqueue export task"})
		return
	}

	// 3. Return an immediate 202 Accepted response
	c.JSON(http.StatusAccepted, gin.H{
		"message": "Playlist M3U zip export started",
		"task_id": info.ID,
		"queue":   info.Queue,
	})
}
