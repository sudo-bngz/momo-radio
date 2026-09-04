package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/hibiken/asynq"
	"go.uber.org/zap"
	"gorm.io/gorm"

	"momo-radio/internal/ingest"
	"momo-radio/internal/logger"
	"momo-radio/internal/models"
)

// SettingsHandler handles tenant-specific workspace and broadcast settings
type SettingsHandler struct {
	db          *gorm.DB
	asynqClient *asynq.Client
}

// NewSettingsHandler creates a new instance of the handler
func NewSettingsHandler(db *gorm.DB, asynqClient *asynq.Client) *SettingsHandler {
	return &SettingsHandler{
		db:          db,
		asynqClient: asynqClient,
	}
}

// GetOrgSettings retrieves the organization's settings, creating defaults if none exist
func (h *SettingsHandler) GetOrgSettings(c *gin.Context) {
	orgID, _ := getOrgID(c)

	var settings models.OrganizationSettings

	// FirstOrCreate ensures the frontend never gets a 404 on the settings page.
	// It will insert a row with default values if this tenant has never saved settings before.
	if err := h.db.FirstOrCreate(&settings, models.OrganizationSettings{
		OrganizationID: orgID,
	}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve settings"})
		return
	}

	c.JSON(http.StatusOK, settings)
}

// UpdateOrgSettings saves the modified settings payload to the database
func (h *SettingsHandler) UpdateOrgSettings(c *gin.Context) {
	orgID, _ := getOrgID(c)

	var req models.OrganizationSettings
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
		return
	}

	// Force the organization ID to match the authenticated user's token
	req.OrganizationID = orgID
	req.UpdatedAt = time.Now()

	// Upsert into Database
	if err := h.db.Save(&req).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save settings"})
		return
	}

	c.JSON(http.StatusOK, req)
}

// TriggerReindex enqueues a background job to rewrite the Meilisearch index
func (h *SettingsHandler) TriggerReindex(c *gin.Context) {
	orgID, ok := getOrgID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// 1. Build the payload
	payload, err := json.Marshal(ingest.ReindexCatalogPayload{
		OrganizationID: orgID.String(),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to marshal payload"})
		return
	}

	// 2. Create the task
	task := asynq.NewTask(ingest.TypeReindexCatalog, payload)

	// 3. Enqueue it using the injected client
	info, err := h.asynqClient.Enqueue(task)
	if err != nil {
		logger.Log.Error("Could not enqueue reindex task", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not start reindex job"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Reindex job started successfully",
		"task_id": info.ID,
	})
}
