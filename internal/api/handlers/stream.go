package handlers

import (
	"fmt"
	"net/http"
	"time"

	"momo-radio/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// GetMountPoints fetches mounts and injects the dynamic HLS URL
func GetMountPoints(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Extract org ID from your auth middleware context
		orgIDStr := c.GetString("organization_id")
		orgID, err := uuid.Parse(orgIDStr)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid organization id"})
			return
		}

		var org models.Organization
		// Preload MountPoints to fetch everything in one optimized query
		if err := db.Preload("MountPoints").First(&org, "id = ?", orgID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "organization not found"})
			return
		}

		// Dynamically generate the HlsUrl for each mount point based on the tenant's slug
		for i := range org.MountPoints {
			org.MountPoints[i].HlsUrl = fmt.Sprintf("https://%s.momo.radio/hls/%s/index.m3u8", org.StationSlug, org.MountPoints[i].Slug)
		}

		c.JSON(http.StatusOK, gin.H{"mount_points": org.MountPoints})
	}
}

// CreateMountPoint provisions a new stream profile
func CreateMountPoint(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		orgID, _ := uuid.Parse(c.GetString("organization_id"))

		var req struct {
			Name      string `json:"name" binding:"required"`
			Slug      string `json:"slug" binding:"required,alphanum"` // Prevent weird chars in URLs
			Bitrate   int    `json:"bitrate" binding:"required,oneof=64 128 192 320"`
			IsDefault bool   `json:"is_default"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// If setting as default, you should transactionally unset the others
		if req.IsDefault {
			db.Model(&models.MountPoint{}).
				Where("organization_id = ?", orgID).
				Update("is_default", false)
		}

		mount := models.MountPoint{
			OrganizationID: orgID,
			Name:           req.Name,
			Slug:           req.Slug,
			Bitrate:        req.Bitrate,
			IsDefault:      req.IsDefault,
		}

		if err := db.Create(&mount).Error; err != nil {
			// If idx_org_mount_slug triggers, GORM throws a constraint error
			c.JSON(http.StatusConflict, gin.H{"error": "mount point slug already exists for this station"})
			return
		}

		// Fetch just the station slug to return the complete HlsUrl to the frontend immediately
		var org models.Organization
		db.Select("station_slug").First(&org, "id = ?", orgID)
		mount.HlsUrl = fmt.Sprintf("https://%s.momo.radio/hls/%s/index.m3u8", org.StationSlug, mount.Slug)

		c.JSON(http.StatusCreated, mount)
	}
}

// AuthStreamPublish handles RTMP ingest authentication webhooks
// Route: POST /api/internal/auth-publish
func AuthStreamPublish(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Nginx-RTMP sends stream keys in the "name" form parameter by default.
		// We use Bind to support both form-urlencoded and JSON setups gracefully.
		var req struct {
			Name string `form:"name" json:"name" binding:"required"`
		}

		if err := c.ShouldBind(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "missing stream key parameter"})
			return
		}

		var org models.Organization
		// 1. Look up the organization owning this unique cryptographic stream key
		err := db.Where("stream_key = ?", req.Name).First(&org).Error
		if err != nil {
			if err == gorm.ErrRecordNotFound {
				// Returning a non-2xx status code tells the RTMP engine to reject the connection
				c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid stream key"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "database verification error"})
			return
		}

		// 2. Flip the station's stream state to 'live' mode in a single transaction
		// This tells your background engine pipeline to immediately switch its source feed.
		err = db.Model(&models.StreamState{}).
			Where("organization_id = ?", org.ID).
			Updates(map[string]any{
				"broadcast_mode": "live",
				"updated_at":     time.Now(), // Trigger heartbeat update
			}).Error

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update broadcast state machine"})
			return
		}

		// 3. Respond with HTTP 200 OK to tell the RTMP proxy to allow transmission
		c.JSON(http.StatusOK, gin.H{
			"message":         "authenticated",
			"organization_id": org.ID,
			"station_slug":    org.StationSlug,
		})
	}
}
