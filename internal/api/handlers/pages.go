package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
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

// resolveAssetURL dynamically builds the absolute public URL based on CDN configuration
func (h *PublicPageHandler) resolveAssetURL(key string) string {
	if key == "" {
		return ""
	}
	if h.config.CDN.Enabled {
		cdnDomain := strings.TrimPrefix(h.config.CDN.Domain, "https://")
		cdnDomain = strings.TrimPrefix(cdnDomain, "http://")
		return fmt.Sprintf("https://%s/%s", cdnDomain, key)
	}

	endpoint := strings.TrimPrefix(h.config.Storage.Endpoint, "https://")
	endpoint = strings.TrimPrefix(endpoint, "http://")
	return fmt.Sprintf("https://%s.%s/%s", h.config.Storage.BucketPublicPage, endpoint, key)
}

// GetSettings retrieves the current configuration and resolves storage keys to full URLs for the frontend
func (h *PublicPageHandler) GetSettings(c *gin.Context) {
	orgID, _ := getOrgID(c)

	var page models.PublicPage
	if err := h.db.Where("organization_id = ?", orgID).First(&page).Error; err != nil {
		// Return a default presentation layer if they haven't configured one yet
		c.JSON(http.StatusOK, gin.H{
			"theme_mode":           "dark",
			"accent_color":         "#ff0055",
			"visual_mode":          "preset",
			"hydra_preset":         "oscillator",
			"logo_key":             "",
			"logo_url":             "",
			"background_image_key": "",
			"background_image_url": "",
			"custom_css":           "",
			"hydra_code":           "",
			"bio":                  "",
			"slug":                 "",
			"base_domain":          h.config.Radio.PublicDomain,
		})
		return
	}

	// Map DB model to outbound JSON payload containing absolute URLs for previews
	c.JSON(http.StatusOK, gin.H{
		"organization_id":      page.OrganizationID,
		"theme_mode":           page.ThemeMode,
		"accent_color":         page.AccentColor,
		"custom_css":           page.CustomCSS,
		"visual_mode":          page.VisualMode,
		"hydra_preset":         page.HydraPreset,
		"hydra_code":           page.HydraCode,
		"logo_key":             page.LogoKey,
		"logo_url":             h.resolveAssetURL(page.LogoKey),
		"background_image_key": page.BackgroundImageKey,
		"background_image_url": h.resolveAssetURL(page.BackgroundImageKey),
		"bio":                  page.Bio,
		"slug":                 page.Slug,
		"base_domain":          h.config.Radio.PublicDomain,
		"updated_at":           page.UpdatedAt,
	})
}

// UpdateSettings saves the relational DB key records AND deploys a flat JSON artifact to the CDN bucket
func (h *PublicPageHandler) UpdateSettings(c *gin.Context) {
	orgID, _ := getOrgID(c)

	var req models.PublicPage
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Enforce OrgID from the authenticated session context
	var parsedOrgID uuid.UUID
	if idStr, ok := any(orgID).(string); ok {
		parsedOrgID, _ = uuid.Parse(idStr)
	} else if idUUID, ok := any(orgID).(uuid.UUID); ok {
		parsedOrgID = idUUID
	}
	req.OrganizationID = parsedOrgID
	req.UpdatedAt = time.Now()

	// 1. ⚡️ Fetch existing record to check if the slug changed
	var existingPage models.PublicPage
	if err := h.db.Where("organization_id = ?", parsedOrgID).First(&existingPage).Error; err != nil && err != gorm.ErrRecordNotFound {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error while verifying station"})
		return
	}

	oldSlug := existingPage.Slug
	newSlug := req.Slug

	// 2. ⚡️ Validate Slug Uniqueness (if they are claiming a new one)
	if newSlug != "" && newSlug != oldSlug {
		var count int64
		h.db.Model(&models.PublicPage{}).Where("slug = ? AND organization_id != ?", newSlug, parsedOrgID).Count(&count)
		if count > 0 {
			c.JSON(http.StatusConflict, gin.H{"error": "This URL is already taken by another station"})
			return
		}
	}

	// 3. Upsert into Database (Source of Truth)
	if err := h.db.Save(&req).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save configuration to database"})
		return
	}

	// 4. Resolve absolute paths to publish to CDN JSON artifact
	exportData := map[string]any{
		"theme_mode":           req.ThemeMode,
		"accent_color":         req.AccentColor,
		"custom_css":           req.CustomCSS,
		"visual_mode":          req.VisualMode,
		"hydra_preset":         req.HydraPreset,
		"hydra_code":           req.HydraCode,
		"background_image_url": h.resolveAssetURL(req.BackgroundImageKey),
		"logo_url":             h.resolveAssetURL(req.LogoKey),
		"bio":                  req.Bio,
		"slug":                 req.Slug,
		"updated_at":           req.UpdatedAt.Unix(),
	}

	jsonData, err := json.Marshal(exportData)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to serialize CDN metadata"})
		return
	}

	// 5. ⚡️ Publish to the SLUG path, falling back to UUID if slug is empty
	folderPath := newSlug
	if folderPath == "" {
		folderPath = parsedOrgID.String()
	}
	destKey := fmt.Sprintf("%s/theme.json", folderPath)

	// Commit static payload to Cloud/Object Storage
	err = h.storage.UploadPublicPageFile(
		destKey,
		bytes.NewReader(jsonData),
		"application/json",
		"public, max-age=60, s-maxage=300",
	)

	if err != nil {
		fmt.Printf("B2 Static Deploy Error for %s: %v\n", parsedOrgID.String(), err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Saved to DB, but failed to publish to CDN: " + err.Error()})
		return
	}

	// 6. ⚡️ Cleanup the old B2 path if the slug changed so you don't leak storage
	if oldSlug != "" && oldSlug != newSlug {
		oldKey := fmt.Sprintf("%s/theme.json", oldSlug)
		go func(key string) {
			// Ensure you add DeletePublicPageFile to your storage/client.go!
			if deleteErr := h.storage.DeletePublicPageFile(key); deleteErr != nil {
				fmt.Printf("Failed to delete old theme.json at %s: %v\n", key, deleteErr)
			}
		}(oldKey)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Published successfully", "data": req})
}

// UploadImage handles direct file uploads for logos and backgrounds with strict size/type controls
func (h *PublicPageHandler) UploadImage(c *gin.Context) {
	orgID, _ := getOrgID(c)

	imageType := c.PostForm("type") // "logo" or "background"
	if imageType != "logo" && imageType != "background" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid upload type. Must be 'logo' or 'background'"})
		return
	}

	// Strict file size thresholds: 2MB for logos, 10MB for background imagery
	var maxFileSize int64 = 1024 * 1024 * 10 // 10MB
	if imageType == "logo" {
		maxFileSize = 1024 * 1024 * 2 // 2MB
	}

	// Restrict incoming request body parsing size
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxFileSize)

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		if err.Error() == "http: request body too large" {
			c.JSON(http.StatusRequestEntityTooLarge, gin.H{
				"error": fmt.Sprintf("File size exceeds maximum limit allowed (%d MB)", maxFileSize/(1024*1024)),
			})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file received"})
		return
	}
	defer file.Close()

	// MIME content check
	contentType := header.Header.Get("Content-Type")
	allowedTypes := map[string]bool{
		"image/jpeg":    true,
		"image/png":     true,
		"image/webp":    true,
		"image/gif":     true,
		"image/svg+xml": true,
	}

	if !allowedTypes[contentType] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unsupported file format. Allowed formats: JPEG, PNG, WEBP, GIF, SVG"})
		return
	}

	parts := strings.Split(header.Filename, ".")
	ext := ""
	if len(parts) > 1 {
		ext = "." + parts[len(parts)-1]
	}

	var parsedOrgID uuid.UUID
	if idStr, ok := any(orgID).(string); ok {
		parsedOrgID, _ = uuid.Parse(idStr)
	} else if idUUID, ok := any(orgID).(uuid.UUID); ok {
		parsedOrgID = idUUID
	}

	// Generate clean relative path storage key
	destKey := fmt.Sprintf("%s/%s%s", parsedOrgID.String(), imageType, ext)

	err = h.storage.UploadPublicPageFile(
		destKey,
		file,
		contentType,
		"public, max-age=31536000, s-maxage=31536000",
	)

	if err != nil {
		fmt.Printf("Object storage upload execution failure: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to push image asset to cloud storage"})
		return
	}

	// Return both the relative tracking key and dynamic absolute url for live client state updates
	c.JSON(http.StatusOK, gin.H{
		"key": destKey,
		"url": h.resolveAssetURL(destKey),
	})
}
