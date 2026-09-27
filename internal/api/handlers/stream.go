package handlers

import (
	"context"
	"encoding/json"
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

	ctx := c.Request.Context()

	// 1. Send control signal to audio engine
	payload := fmt.Sprintf(`{"org_id": "%s", "action": "%s"}`, orgID, req.Action)
	h.rdb.Publish(ctx, "radio.control", payload)

	// 2. UI SSE status update (Triggers the LIVE red dot)
	channelKey := fmt.Sprintf("org:%s:stream_events", orgID)
	isLive := newState == "online"
	msg, _ := json.Marshal(map[string]bool{"is_live": isLive})
	h.rdb.Publish(ctx, channelKey, msg)

	// 3. Synchronize the Now Playing cache instantly
	// This ensures your StreamNowPlaying handler ALWAYS has data to send on load.
	nowPlayingKey := fmt.Sprintf("radio:%s:now_playing", orgID)
	var nowPlayingJSON string
	if isLive {
		nowPlayingJSON = `{"title": "Booting Engine...", "artist": "System"}`
	} else {
		nowPlayingJSON = `{"title": "Silence", "artist": "Station Offline"}`
	}

	// Write to cache for new connections
	h.rdb.Set(ctx, nowPlayingKey, nowPlayingJSON, 0)
	// Broadcast to already-listening connections
	h.rdb.Publish(ctx, nowPlayingKey, nowPlayingJSON)

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
func AuthStreamPublish(db *gorm.DB, rdb *redis.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req MediaMTXAuthRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid json payload from mediamtx"})
			return
		}

		if req.Action != "publish" {
			c.Status(http.StatusOK)
			return
		}

		parts := strings.Split(req.Path, "/")
		if len(parts) < 1 {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid stream path structure"})
			return
		}
		tenantID := parts[0]

		var org models.Organization
		err := db.Where("id = ? AND stream_key = ?", tenantID, req.Password).First(&org).Error
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid stream key or tenant not found"})
			return
		}

		// 1. Update Database
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

		// 2. ⚡️ Publish Real-time Event to Redis
		channelKey := fmt.Sprintf("org:%s:stream_events", org.ID.String())
		msg, _ := json.Marshal(map[string]bool{"is_live": true})
		rdb.Publish(c.Request.Context(), channelKey, msg)

		c.JSON(http.StatusOK, gin.H{
			"message":         "authenticated",
			"organization_id": org.ID,
			"station_slug":    org.StationSlug,
		})
	}
}

// MediaMTXWebhook handles runOnPublishDone to notify when a stream disconnects
func (h *BroadcastHandler) MediaMTXWebhook(c *gin.Context) {
	action := c.Query("action") // Expecting "stop"
	orgID := c.Query("org_id")

	if action == "stop" && orgID != "" {
		// 1. Revert Database State
		h.db.Model(&models.StreamState{}).
			Where("organization_id = ?", orgID).
			Update("broadcast_mode", "offline")

		// 2. Publish Real-time Disconnect Event to Redis
		channelKey := fmt.Sprintf("org:%s:stream_events", orgID)
		msg, _ := json.Marshal(map[string]bool{"is_live": false})
		h.rdb.Publish(c.Request.Context(), channelKey, msg)
	}

	c.Status(http.StatusOK)
}

func (h *BroadcastHandler) GetStreamState(c *gin.Context) {
	orgID, _ := getOrgID(c)

	var state models.StreamState
	err := h.db.Select("broadcast_mode").Where("organization_id = ?", orgID).First(&state).Error

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

func (h *BroadcastHandler) StreamStateSSE(c *gin.Context) {
	orgID, ok := getOrgID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	orgIDStr := fmt.Sprintf("%s", orgID)

	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Flush()

	ctx, cancel := context.WithCancel(c.Request.Context())
	defer cancel()

	channelKey := fmt.Sprintf("org:%s:stream_events", orgIDStr)
	pubsub := h.rdb.Subscribe(ctx, channelKey)
	defer pubsub.Close()
	ch := pubsub.Channel()

	var state models.StreamState
	h.db.Select("broadcast_mode").Where("organization_id = ?", orgID).First(&state)
	isLive := state.BroadcastMode == "online" || state.BroadcastMode == "live"

	initialMsg, _ := json.Marshal(map[string]bool{"is_live": isLive})
	fmt.Fprintf(c.Writer, "data: %s\n\n", initialMsg)
	c.Writer.Flush()

	for {
		select {
		case <-ctx.Done():
			return
		case msg := <-ch:
			fmt.Fprintf(c.Writer, "data: %s\n\n", msg.Payload)
			c.Writer.Flush()
		}
	}
}

type MetadataPayload struct {
	Title        string `json:"title"`
	Artist       any    `json:"artist"` // Matches your frontend's string or object structure
	PlaylistName string `json:"playlist_name,omitempty"`
	CoverURL     string `json:"cover_url,omitempty"`
	StartsAt     string `json:"starts_at,omitempty"`
	EndsAt       string `json:"ends_at,omitempty"`
	DurationMs   int    `json:"duration_ms,omitempty"`
}

// UpdateMetadataWebhook receives track changes from Liquidsoap/AutoDJ
func (h *BroadcastHandler) UpdateMetadataWebhook(c *gin.Context) {
	orgID := c.Param("org_id")

	var payload MetadataPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid metadata payload"})
		return
	}

	// Convert back to JSON string for Redis
	msgBytes, _ := json.Marshal(payload)
	msgJSON := string(msgBytes)

	nowPlayingKey := fmt.Sprintf("radio:%s:now_playing", orgID)
	ctx := c.Request.Context()

	// 1. Update the cache for any new listeners who connect mid-song
	h.rdb.Set(ctx, nowPlayingKey, msgJSON, 0)

	// 2. Instantly push the new track to the React TopNav
	h.rdb.Publish(ctx, nowPlayingKey, msgJSON)

	c.JSON(http.StatusOK, gin.H{"status": "metadata updated"})
}
