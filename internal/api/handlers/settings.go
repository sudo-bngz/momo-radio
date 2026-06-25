package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"momo-radio/internal/models"
)

// SettingsHandler handles tenant-specific workspace and broadcast settings
type SettingsHandler struct {
	db *gorm.DB
}

// NewSettingsHandler creates a new instance of the handler
func NewSettingsHandler(db *gorm.DB) *SettingsHandler {
	return &SettingsHandler{
		db: db,
	}
}

// GetOrgSettings retrieves the organization's settings, creating defaults if none exist
func (h *SettingsHandler) GetOrgSettings(c *gin.Context) {
	// Assuming getOrgID returns (uuid.UUID, error/bool)
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
