package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"momo-radio/internal/config"
	"momo-radio/internal/models"
	"momo-radio/internal/storage"
)

type PublicPageHandler struct {
	db      *gorm.DB
	storage *storage.Client
	config  *config.Config
}

func NewPublicPageHandler(db *gorm.DB, store *storage.Client, cfg *config.Config) *PublicPageHandler {
	return &PublicPageHandler{
		db:      db,
		storage: store,
		config:  cfg,
	}
}

// GetSettings retrieves the current configuration for the dashboard GUI
func (h *PublicPageHandler) GetSettings(c *gin.Context) {
	orgID, _ := getOrgID(c)

	var page models.PublicPage
	if err := h.db.Where("organization_id = ?", orgID).First(&page).Error; err != nil {
		// Return a default struct if they haven't configured one yet
		c.JSON(http.StatusOK, models.PublicPage{
			ThemeMode:   "dark",
			AccentColor: "#ff0055",
			VisualMode:  "preset",
			HydraPreset: "oscillator",
		})
		return
	}

	c.JSON(http.StatusOK, page)
}

// UpdateSettings saves the DB record AND deploys the JSON artifact to B2
func (h *PublicPageHandler) UpdateSettings(c *gin.Context) {
	orgID, _ := getOrgID(c)

	var req models.PublicPage
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 1. Ensure the OrgID is enforced from the token, not the payload
	var parsedOrgID uuid.UUID
	if idStr, ok := any(orgID).(string); ok {
		parsedOrgID, _ = uuid.Parse(idStr)
	} else if idUUID, ok := any(orgID).(uuid.UUID); ok {
		parsedOrgID = idUUID
	}
	req.OrganizationID = parsedOrgID
	req.UpdatedAt = time.Now()

	// 2. Upsert into Database (Source of Truth)
	err := h.db.Save(&req).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save configuration"})
		return
	}

	// 3. Publish to B2 / BunnyCDN Edge
	exportData := map[string]any{
		"theme_mode":           req.ThemeMode,
		"accent_color":         req.AccentColor,
		"custom_css":           req.CustomCSS,
		"visual_mode":          req.VisualMode,
		"hydra_preset":         req.HydraPreset,
		"hydra_code":           req.HydraCode,
		"background_image_url": req.BackgroundImageURL,
		"logo_url":             req.LogoURL,
		"bio":                  req.Bio,
		"updated_at":           req.UpdatedAt.Unix(),
	}

	jsonData, _ := json.Marshal(exportData)

	// Note: If BunnyCDN maps directly to the root of the bucket,
	// you might just want "{tenant_uuid}/theme.json" without the "public-pages/" prefix.
	destKey := fmt.Sprintf("%s/theme.json", parsedOrgID.String())

	// Call the newly created wrapper method
	err = h.storage.UploadPublicPageFile(
		destKey,
		bytes.NewReader(jsonData),
		"application/json",
		"public, max-age=60, s-maxage=300",
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Saved to DB, but failed to publish to CDN " + err.Error()})
		return
	}

	if err != nil {
		// Highly recommended to log the actual AWS/B2 error to your console
		fmt.Printf("B2 Upload Error for %s: %v\n", parsedOrgID.String(), err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Saved to DB, but failed to publish to CDN"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Published successfully", "data": req})
}
