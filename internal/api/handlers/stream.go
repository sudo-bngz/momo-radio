package handlers

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"momo-radio/internal/config"
	"momo-radio/internal/models"
	"momo-radio/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

type BroadcastHandler struct {
	db  *gorm.DB
	rdb *redis.Client
	cdn *utils.CDNBuilder
	cfg *config.Config
}

// NewBroadcastHandler initializes the broadcast controller with DB, Redis, CDN, and Config
func NewBroadcastHandler(db *gorm.DB, rdb *redis.Client, cdn *utils.CDNBuilder, cfg *config.Config) *BroadcastHandler {
	return &BroadcastHandler{
		db:  db,
		rdb: rdb,
		cdn: cdn,
		cfg: cfg,
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

	newState := "offline"
	if req.Action == "start" {
		newState = "online"
	}

	err := h.db.Model(&models.StreamState{}).
		Where("organization_id = ?", orgID).
		Update("broadcast_mode", newState).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update state"})
		return
	}

	payload := fmt.Sprintf(`{"org_id": "%s", "action": "%s"}`, orgID, req.Action)
	h.rdb.Publish(c.Request.Context(), "radio.control", payload)

	c.JSON(http.StatusOK, gin.H{"status": "signaled", "state": newState})
}

// GetMountPoints fetches streams and injects the dynamic HLS URL using CDNBuilder
func GetMountPoints(db *gorm.DB, cdn *utils.CDNBuilder) gin.HandlerFunc {
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

		for i := range org.MountPoints {
			org.MountPoints[i].HlsUrl = cdn.GetHLSStreamURL(org.ID, org.MountPoints[i].Slug)
		}

		c.JSON(http.StatusOK, gin.H{"mount_points": org.MountPoints})
	}
}

// CreateMountPoint provisions a new stream profile
func CreateMountPoint(db *gorm.DB, cdn *utils.CDNBuilder) gin.HandlerFunc {
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

			mount.HlsUrl = cdn.GetHLSStreamURL(parsedOrgID, mount.Slug)

			c.JSON(http.StatusCreated, mount)
			return nil
		})

		if err != nil {
			c.JSON(http.StatusConflict, gin.H{"error": "stream generation conflict or slug uniqueness constraint violation"})
		}
	}
}

// MediaMTXAuthRequest matches the exact JSON payload MediaMTX sends on publish
type MediaMTXAuthRequest struct {
	Action   string `json:"action"`
	Path     string `json:"path"`     // e.g., "org-uuid-123/radio"
	Password string `json:"password"` // The Stream Key
}

// AuthStreamPublish handles RTMP ingest authentication webhooks from MediaMTX
func AuthStreamPublish(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req MediaMTXAuthRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid json payload from mediamtx"})
			return
		}

		// We only care about authorizing publishers (DJs and AutoDJ).
		// Return 200 OK to allow readers if not excluded via MediaMTX config.
		if req.Action != "publish" {
			c.Status(http.StatusOK)
			return
		}

		// Extract tenant from path (e.g. "org-uuid/radio" -> "org-uuid")
		parts := strings.Split(req.Path, "/")
		if len(parts) < 1 {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid stream path structure"})
			return
		}
		tenantID := parts[0]

		var org models.Organization
		// req.Password contains the stream key sent by OBS/FFmpeg
		err := db.Where("id = ? AND stream_key = ?", tenantID, req.Password).First(&org).Error
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid stream key or tenant not found"})
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

		// MediaMTX expects a 200 OK status to authorize the stream and begin processing HLS chunks.
		c.JSON(http.StatusOK, gin.H{
			"message":         "authenticated",
			"organization_id": org.ID,
			"station_slug":    org.StationSlug,
		})
	}
}

func (h *BroadcastHandler) GetStreamState(c *gin.Context) {
	orgID, _ := getOrgID(c)

	var state models.StreamState
	err := h.db.Select("broadcast_mode").Where("organization_id = ?", orgID).First(&state).Error

	// Load the timezone from the global config (fallback to UTC if invalid)
	loc, locErr := time.LoadLocation(h.cfg.Server.Timezone)
	if locErr != nil {
		loc = time.UTC
	}
	serverTime := time.Now().In(loc).Format(time.RFC3339)

	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"state":       "offline",
			"server_time": serverTime,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"state":       state.BroadcastMode,
		"server_time": serverTime,
	})
}
