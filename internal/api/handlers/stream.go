package handlers

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"momo-radio/internal/config"
	"momo-radio/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

type BroadcastHandler struct {
	db  *gorm.DB
	rdb *redis.Client
}

// NewBroadcastHandler initializes the broadcast controller with DB and Redis
func NewBroadcastHandler(db *gorm.DB, rdb *redis.Client) *BroadcastHandler {
	return &BroadcastHandler{
		db:  db,
		rdb: rdb,
	}
}

func (h *BroadcastHandler) ToggleStream(c *gin.Context) {
	orgID, _ := getOrgID(c)

	var req struct {
		Action string `json:"action" binding:"required,oneof=start stop"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 1. Update the Database (Source of Truth)
	newState := "offline"
	if req.Action == "start" {
		newState = "online"
	}

	// ⚡️ USE h.db DIRECTLY
	err := h.db.Model(&models.StreamState{}).
		Where("organization_id = ?", orgID).
		Update("broadcast_mode", newState).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update state"})
		return
	}

	// 2. Fire the Signal via Redis Pub/Sub
	payload := fmt.Sprintf(`{"org_id": "%s", "action": "%s"}`, orgID, req.Action)
	h.rdb.Publish(c.Request.Context(), "radio.control", payload)

	c.JSON(http.StatusOK, gin.H{"status": "signaled", "state": newState})
}

// generateHlsURL dynamically routes between the CDN, direct S3, or a local fallback
func generateHlsURL(cfg *config.Config, slug string, orgID string) string {
	// The exact physical path your worker uses to save the manifest
	objectPath := fmt.Sprintf("/%s/%s/stream.m3u8", orgID, slug)

	// 1. Production: CDN is toggled ON
	if cfg.CDN.Enabled && cfg.CDN.Domain != "" {
		domain := strings.TrimRight(cfg.CDN.Domain, "/")
		return fmt.Sprintf("https://%s%s", domain, objectPath)
	}

	// 2. Testing: CDN is OFF, return direct B2/S3 Virtual-Hosted Bucket URL
	if cfg.Storage.Provider == "s3" {
		cleanEndpoint := strings.TrimPrefix(cfg.Storage.Endpoint, "https://")
		cleanEndpoint = strings.TrimPrefix(cleanEndpoint, "http://")
		cleanEndpoint = strings.TrimRight(cleanEndpoint, "/")
		return fmt.Sprintf("https://%s.%s%s", cfg.Storage.BucketStream, cleanEndpoint, objectPath)
	}

	// 3. Fallback: Local testing without S3
	domain := strings.TrimRight(cfg.Radio.PublicDomain, "/")
	return fmt.Sprintf("https://%s%s", domain, objectPath)
}

// GetMountPoints fetches streams and injects the dynamic HLS URL
func GetMountPoints(db *gorm.DB, cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		orgID, ok := getOrgID(c)
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Organization context missing"})
			return
		}

		var org models.Organization
		if err := db.Preload("MountPoints").First(&org, "id = ?", orgID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "organization not found"})
			return
		}

		// Ensure orgID is a string for the URL generator
		orgIDStr := fmt.Sprintf("%v", orgID)

		for i := range org.MountPoints {
			org.MountPoints[i].HlsUrl = generateHlsURL(cfg, org.MountPoints[i].Slug, orgIDStr)
		}

		c.JSON(http.StatusOK, gin.H{"mount_points": org.MountPoints})
	}
}

// CreateMountPoint provisions a new stream profile
func CreateMountPoint(db *gorm.DB, cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		orgID, ok := getOrgID(c)
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Organization context missing"})
			return
		}

		var parsedOrgID uuid.UUID
		if idStr, isString := any(orgID).(string); isString {
			parsedOrgID, _ = uuid.Parse(idStr)
		} else if idUUID, isUUID := any(orgID).(uuid.UUID); isUUID {
			parsedOrgID = idUUID
		}

		var req struct {
			Name      string `json:"name" binding:"required"`
			Slug      string `json:"slug" binding:"required,alphanum"`
			Bitrate   int    `json:"bitrate" binding:"required,oneof=64 128 192 320"`
			IsDefault bool   `json:"is_default"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		err := db.Transaction(func(tx *gorm.DB) error {
			if req.IsDefault {
				if err := tx.Model(&models.MountPoint{}).
					Where("organization_id = ?", parsedOrgID).
					Update("is_default", false).Error; err != nil {
					return err
				}
			}

			mount := models.MountPoint{
				OrganizationID: parsedOrgID,
				Name:           req.Name,
				Slug:           req.Slug,
				Bitrate:        req.Bitrate,
				IsDefault:      req.IsDefault,
			}

			if err := tx.Create(&mount).Error; err != nil {
				return err
			}

			mount.HlsUrl = generateHlsURL(cfg, mount.Slug, parsedOrgID.String())
			c.JSON(http.StatusCreated, mount)
			return nil
		})

		if err != nil {
			c.JSON(http.StatusConflict, gin.H{"error": "stream generation conflict or slug uniqueness constraint violation"})
		}
	}
}

// AuthStreamPublish handles RTMP ingest authentication webhooks
func AuthStreamPublish(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Name string `form:"name" json:"name" binding:"required"`
		}

		if err := c.ShouldBind(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "missing stream key parameter"})
			return
		}

		var org models.Organization
		err := db.Where("stream_key = ?", req.Name).First(&org).Error
		if err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid stream key"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "database verification error"})
			return
		}

		err = db.Model(&models.StreamState{}).
			Where("organization_id = ?", org.ID).
			Updates(map[string]any{
				"broadcast_mode": "live",
				"updated_at":     time.Now(),
			}).Error

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update broadcast state machine"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message":         "authenticated",
			"organization_id": org.ID,
			"station_slug":    org.StationSlug,
		})
	}
}
