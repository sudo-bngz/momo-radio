package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"momo-radio/internal/config"
	"momo-radio/internal/models"
	"momo-radio/internal/storage"
	"momo-radio/internal/utils"
)

type ShareHandler struct {
	db      *gorm.DB
	storage *storage.Client
	cfg     *config.Config
	cdn     *utils.CDNBuilder
}

func NewShareHandler(db *gorm.DB, storage *storage.Client, cfg *config.Config, cdn *utils.CDNBuilder) *ShareHandler {
	return &ShareHandler{
		db:      db,
		storage: storage,
		cfg:     cfg,
		cdn:     cdn,
	}
}

func generateShareToken(length int) (string, error) {
	bytes := make([]byte, length)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// ============================================================================
// PROTECTED PRODUCER ENDPOINTS
// ============================================================================

type CreateShareRequest struct {
	TrackID       uint `json:"track_id" binding:"required"`
	AllowDownload bool `json:"allow_download"`
	ExpiresInDays *int `json:"expires_in_days"`
}

func (h *ShareHandler) CreateShare(c *gin.Context) {
	orgID, ok := getOrgID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: missing organization context"})
		return
	}

	var req CreateShareRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var track models.Track
	if err := h.db.Where("id = ? AND organization_id = ?", req.TrackID, orgID).First(&track).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Track not found"})
		return
	}

	token, err := generateShareToken(16)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	var expiresAt *time.Time
	if req.ExpiresInDays != nil && *req.ExpiresInDays > 0 {
		exp := time.Now().AddDate(0, 0, *req.ExpiresInDays)
		expiresAt = &exp
	}

	share := models.Share{
		OrganizationID: orgID,
		TrackID:        track.ID,
		Token:          token,
		AllowDownload:  req.AllowDownload,
		ExpiresAt:      expiresAt,
	}

	if err := h.db.Create(&share).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create share link"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"share": share,
		"url":   fmt.Sprintf("%s/s/%s", h.cfg.Server.PublicAPIURL, share.Token),
	})
}

func (h *ShareHandler) GetShares(c *gin.Context) {
	orgID, ok := getOrgID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: missing organization context"})
		return
	}

	var shares []models.Share
	dbErr := h.db.Where("organization_id = ?", orgID).
		Preload("Track.Artists").
		Preload("Track.Album").
		Order("created_at DESC").
		Find(&shares).Error

	if dbErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch shared tracks"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": shares})
}

func (h *ShareHandler) DeleteShare(c *gin.Context) {
	orgID, ok := getOrgID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: missing organization context"})
		return
	}

	shareID := c.Param("id")

	result := h.db.Where("id = ? AND organization_id = ?", shareID, orgID).Delete(&models.Share{})
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete share"})
		return
	}

	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Share link not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Share link revoked successfully"})
}

// ============================================================================
// PUBLIC RECIPIENT ENDPOINTS (Unauthenticated)
// ============================================================================

func (h *ShareHandler) GetPublicShare(c *gin.Context) {
	token := c.Param("token")

	var share models.Share
	err := h.db.Where("token = ?", token).
		Preload("Track.Artists").
		Preload("Track.Album").
		First(&share).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Share link invalid or expired"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	if share.ExpiresAt != nil && time.Now().After(*share.ExpiresAt) {
		c.JSON(http.StatusGone, gin.H{"error": "This link has expired"})
		return
	}

	orgIDStr := share.OrganizationID.String()

	coverURL := ""
	if share.Track.Album.CoverKey != "" {
		coverURL = h.cdn.BuildAssetURL(share.Track.Album.CoverKey, orgIDStr)
	}

	waveformURL := ""
	if share.Track.WaveformKey != "" {
		waveformURL = h.cdn.BuildAssetURL(share.Track.WaveformKey, orgIDStr)
	}

	c.JSON(http.StatusOK, gin.H{
		"token":          share.Token,
		"allow_download": share.AllowDownload,
		"expires_at":     share.ExpiresAt,
		"track": gin.H{
			"id":           share.Track.ID,
			"title":        share.Track.Title,
			"duration":     share.Track.Duration,
			"bpm":          share.Track.BPM,
			"musical_key":  share.Track.MusicalKey,
			"scale":        share.Track.Scale,
			"genre":        share.Track.Genre,
			"style":        share.Track.Style,
			"artists":      share.Track.Artists,
			"album":        share.Track.Album,
			"cover_url":    coverURL,
			"waveform_url": waveformURL,
			"stream_url":   fmt.Sprintf("/api/v1/public/shares/%s/stream", share.Token),
		},
	})
}

func (h *ShareHandler) StreamPublicShare(c *gin.Context) {
	token := c.Param("token")

	var share models.Share
	if err := h.db.Where("token = ?", token).Preload("Track").First(&share).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invalid token"})
		return
	}

	if share.ExpiresAt != nil && time.Now().After(*share.ExpiresAt) {
		c.JSON(http.StatusGone, gin.H{"error": "Link expired"})
		return
	}

	go func(id uint) {
		h.db.Model(&models.Share{}).Where("id = ?", id).UpdateColumn("play_count", gorm.Expr("play_count + 1"))
	}(share.ID)

	streamURL := h.cdn.BuildAssetURL(share.Track.Key, share.OrganizationID.String())
	c.Redirect(http.StatusFound, streamURL)
}

func (h *ShareHandler) DownloadPublicShare(c *gin.Context) {
	token := c.Param("token")

	var share models.Share
	if err := h.db.Where("token = ?", token).Preload("Track").First(&share).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invalid token"})
		return
	}

	if !share.AllowDownload {
		c.JSON(http.StatusForbidden, gin.H{"error": "Downloads are not permitted for this share"})
		return
	}

	if share.ExpiresAt != nil && time.Now().After(*share.ExpiresAt) {
		c.JSON(http.StatusGone, gin.H{"error": "Link expired"})
		return
	}

	go func(id uint) {
		h.db.Model(&models.Share{}).Where("id = ?", id).UpdateColumn("download_count", gorm.Expr("download_count + 1"))
	}(share.ID)

	fileKey := share.Track.MasterKey
	if fileKey == "" {
		fileKey = share.Track.Key
	}

	downloadURL := h.cdn.BuildAssetURL(fileKey, share.OrganizationID.String())
	c.Redirect(http.StatusFound, downloadURL)
}
