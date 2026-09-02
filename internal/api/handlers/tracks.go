package handlers

import (
	"context"
	"crypto/tls"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"momo-radio/internal/config"
	"momo-radio/internal/models"
	"momo-radio/internal/storage"
	"momo-radio/internal/utils"

	"github.com/dhowden/tag"
	"github.com/gin-gonic/gin"
	"github.com/hibiken/asynq"
	"github.com/lib/pq"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

type TrackHandler struct {
	db      *gorm.DB
	storage *storage.Client
	config  *config.Config
	redis   *redis.Client
	cdn     *utils.CDNBuilder
}

func NewTrackHandler(db *gorm.DB, st *storage.Client, c *config.Config, redisClient *redis.Client, cdn *utils.CDNBuilder) *TrackHandler {
	return &TrackHandler{
		db:      db,
		storage: st,
		config:  c,
		redis:   redisClient,
		cdn:     cdn,
	}
}

type LibraryTrack struct {
	ID                uint           `json:"id"`
	Title             string         `json:"title"`
	Artist            string         `json:"artist"`
	Album             string         `json:"album"`
	AlbumID           uint           `json:"album_id"`
	Duration          float64        `json:"duration"`
	CoverURL          string         `json:"cover_url"`
	BPM               float64        `json:"bpm"`
	MusicalKey        string         `json:"musical_key"`
	Scale             string         `json:"scale"`
	Style             string         `json:"style"`
	Status            string         `json:"status"`
	Genre             string         `json:"genre"`
	Energy            float64        `json:"energy"`
	MLMoods           pq.StringArray `json:"ml_moods"`
	MLGenres          pq.StringArray `json:"ml_genres"`
	MLCharacteristics pq.StringArray `json:"ml_characteristics"`
}

type PresignRequest struct {
	Filename    string `json:"filename" binding:"required"`
	ContentType string `json:"content_type" binding:"required"`
}

func (h *TrackHandler) HandlePresign(c *gin.Context) {
	orgID, ok := getOrgID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Organization context missing"})
		return
	}

	var req PresignRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
		return
	}

	// Generate a unique, collision-proof storage key
	safeFilename := strings.ReplaceAll(filepath.Base(req.Filename), " ", "_")
	fileKey := fmt.Sprintf("incoming/%s/%d_%s", orgID.String(), time.Now().Unix(), safeFilename)

	// Generate the URL directly to Backblaze (Valid for 15 minutes)
	url, err := h.storage.GeneratePresignedUrl(c.Request.Context(), fileKey, req.ContentType, 15*time.Minute)
	if err != nil {
		slog.Error("Failed to generate presigned URL", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate upload URL"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"url": url,
		"key": fileKey,
	})
}

type UploadConfirmPayload struct {
	FileKey string `json:"file_key" binding:"required"`
}

func (h *TrackHandler) UploadTrack(c *gin.Context) {
	orgID, ok := getOrgID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Organization context missing"})
		return
	}

	var req UploadConfirmPayload
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON payload"})
		return
	}

	// 1. Create a "Skeleton" Track in the database
	newTrack := models.Track{
		OrganizationID:     orgID,
		Title:              "Processing Upload...",
		Key:                req.FileKey,
		MasterKey:          req.FileKey,
		ProcessingStatus:   "pending",
		ProcessingProgress: 0,
	}

	if err := h.db.Create(&newTrack).Error; err != nil {
		slog.Error("Failed to create track DB record", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database insert failed"})
		return
	}

	// 2. Enqueue Asynq Task for the background worker
	redisAddr := fmt.Sprintf("%s:%s", h.config.Redis.Host, h.config.Redis.Port)
	var tlsConf *tls.Config
	if h.config.Redis.TLS {
		tlsConf = &tls.Config{MinVersion: tls.VersionTLS12}
	}

	asynqClient := asynq.NewClient(asynq.RedisClientOpt{
		Addr:      redisAddr,
		Password:  h.config.Redis.Password,
		DB:        h.config.Redis.DB,
		TLSConfig: tlsConf,
	})
	defer asynqClient.Close()

	payloadData := map[string]any{
		"track_id": newTrack.ID,
		"file_key": req.FileKey,
	}
	payloadBytes, _ := json.Marshal(payloadData)
	task := asynq.NewTask("track:process", payloadBytes)

	_, err := asynqClient.Enqueue(task)
	if err != nil {
		slog.Error("Failed to queue processing job", "error", err)
		h.db.Model(&newTrack).Update("processing_status", "failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to queue processing job"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"status":   "queued",
		"message":  "File safely in storage, processing started.",
		"track_id": newTrack.ID,
		"key":      req.FileKey,
	})
}

func (h *TrackHandler) GetTracks(c *gin.Context) {
	orgID, ok := getOrgID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Organization context missing or invalid"})
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	search := c.Query("search")
	sortBy := c.DefaultQuery("sort", "newest")
	albumID := c.Query("album_id")

	if limit > 200 {
		limit = 200
	}

	query := h.db.Model(&models.Track{}).
		Preload("Artists").
		Preload("Album").
		Where("tracks.organization_id = ?", orgID)

	if albumID != "" {
		query = query.Where("tracks.album_id = ?", albumID)
	}

	if search != "" {
		searchTerm := "%" + search + "%"
		query = query.Where(
			"tracks.title ILIKE ? OR EXISTS (SELECT 1 FROM track_artists ta JOIN artists a ON a.id = ta.artist_id WHERE ta.track_id = tracks.id AND a.name ILIKE ?)",
			searchTerm, searchTerm,
		)
	}

	var total int64
	query.Count(&total)

	switch sortBy {
	case "alphabetical":
		query = query.Order("tracks.title ASC")
	case "duration":
		query = query.Order("tracks.duration DESC")
	default:
		query = query.Order("tracks.id DESC")
	}

	var tracks []models.Track
	result := query.Limit(limit).Offset(offset).Find(&tracks)

	if result.Error != nil {
		slog.Error("Failed to fetch tracks", "error", result.Error)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	var libraryTracks []LibraryTrack
	for _, t := range tracks {
		var artistNames []string
		for _, a := range t.Artists {
			artistNames = append(artistNames, a.Name)
		}
		artistStr := "Unknown Artist"
		if len(artistNames) > 0 {
			artistStr = strings.Join(artistNames, ", ")
		}

		var coverURL string
		if t.Album.ID != 0 && t.Album.CoverKey != "" {
			coverURL = h.cdn.BuildAssetURL(t.Album.CoverKey, orgID.String())
		}

		libraryTracks = append(libraryTracks, LibraryTrack{
			ID:                t.ID,
			Title:             t.Title,
			Artist:            artistStr,
			Album:             t.Album.Title,
			AlbumID:           t.Album.ID,
			Duration:          t.Duration,
			CoverURL:          coverURL,
			BPM:               t.BPM,
			MusicalKey:        t.MusicalKey,
			Scale:             t.Scale,
			Style:             t.Style,
			Status:            t.ProcessingStatus,
			Genre:             t.Genre,
			Energy:            t.Energy,
			MLMoods:           t.MLMoods,
			MLGenres:          t.MLGenres,
			MLCharacteristics: t.MLCharacteristics,
		})
	}

	if libraryTracks == nil {
		libraryTracks = []LibraryTrack{}
	}

	c.JSON(http.StatusOK, gin.H{
		"data": libraryTracks,
		"meta": gin.H{
			"total":  total,
			"limit":  limit,
			"offset": offset,
		},
	})
}

func (h *TrackHandler) GetTrack(c *gin.Context) {
	orgID, ok := getOrgID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Organization context missing"})
		return
	}

	id := c.Param("id")
	var track models.Track

	if err := h.db.Preload("Artists").Preload("Album").Where("organization_id = ?", orgID).First(&track, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Track not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	c.JSON(http.StatusOK, track)
}

func (h *TrackHandler) UpdateTrack(c *gin.Context) {
	orgID, ok := getOrgID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Organization context missing"})
		return
	}

	id := c.Param("id")
	var updateData map[string]interface{}
	if err := c.ShouldBindJSON(&updateData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
		return
	}

	delete(updateData, "id")
	delete(updateData, "key")
	delete(updateData, "duration")
	delete(updateData, "file_size")
	delete(updateData, "organization_id")

	result := h.db.Model(&models.Track{}).Where("id = ? AND organization_id = ?", id, orgID).Updates(updateData)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update track metadata"})
		return
	}

	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Track not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Track updated successfully"})
}

// NOTE: If you are using this from the frontend, it still sends the file to the server!
// Consider using a JS library like 'music-metadata-browser' to extract tags locally.
func (h *TrackHandler) PreAnalyzeFile(c *gin.Context) {
	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}

	file, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Unable to open file"})
		return
	}
	defer file.Close()

	metadata, err := tag.ReadFrom(file)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"filename": fileHeader.Filename,
			"title":    fileHeader.Filename,
			"artists":  []string{"Unknown Artist"},
		})
		return
	}

	var coverBase64 string
	if pic := metadata.Picture(); pic != nil {
		coverBase64 = fmt.Sprintf("data:%s;base64,%s", pic.MIMEType, base64.StdEncoding.EncodeToString(pic.Data))
	}

	yearStr := ""
	if metadata.Year() != 0 {
		yearStr = strconv.Itoa(metadata.Year())
	}

	c.JSON(http.StatusOK, gin.H{
		"filename":     fileHeader.Filename,
		"format":       string(metadata.Format()),
		"title":        metadata.Title(),
		"artists":      utils.SplitArtistFallback(metadata.Artist()),
		"album":        metadata.Album(),
		"genre":        metadata.Genre(),
		"year":         yearStr,
		"cover_base64": coverBase64,
	})
}

func (h *TrackHandler) StreamTrack(c *gin.Context) {
	orgID, ok := getOrgID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Organization context missing"})
		return
	}

	trackID := c.Param("id")
	var track models.Track

	if err := h.db.Where("organization_id = ?", orgID).First(&track, "id = ?", trackID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Track metadata not found or unauthorized"})
		return
	}

	obj, err := h.storage.DownloadFile(track.Key)
	if err != nil {
		slog.Error("Failed to download audio file from storage",
			"track_id", trackID,
			"key", track.Key,
			"error", err,
		)

		c.JSON(http.StatusNotFound, gin.H{
			"error": fmt.Sprintf("Audio file missing from storage: %v", err),
		})
		return
	}
	defer obj.Body.Close()

	if seeker, ok := obj.Body.(io.ReadSeeker); ok {
		http.ServeContent(c.Writer, c.Request, track.Title, obj.LastModified, seeker)
		return
	}

	extraHeaders := map[string]string{
		"Cache-Control": "public, max-age=31536000",
		"Accept-Ranges": "none",
	}
	c.DataFromReader(http.StatusOK, obj.ContentLength, obj.ContentType, obj.Body, extraHeaders)
}

func (h *TrackHandler) TrackStatusStream(c *gin.Context) {
	orgID, ok := getOrgID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Organization context missing"})
		return
	}

	trackID := c.Param("id")

	var count int64
	h.db.Model(&models.Track{}).Where("id = ? AND organization_id = ?", trackID, orgID).Count(&count)
	if count == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Track not found or unauthorized"})
		return
	}

	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")

	channelName := "track_status:" + trackID
	pubsub := h.redis.Subscribe(context.Background(), channelName)
	defer pubsub.Close()

	ch := pubsub.Channel()
	clientGone := c.Request.Context().Done()

	for {
		select {
		case <-clientGone:
			return
		case msg := <-ch:
			c.SSEvent("status", msg.Payload)
			c.Writer.Flush()
			if msg.Payload == "completed" || msg.Payload == "failed" {
				return
			}
		}
	}
}

func (h *TrackHandler) GetQueue(c *gin.Context) {
	orgID, ok := getOrgID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Organization context missing"})
		return
	}

	var tracks []models.Track

	err := h.db.Where("organization_id = ?", orgID).
		Order("created_at DESC").
		Limit(100).
		Find(&tracks).Error

	if err != nil {
		slog.Error("Failed to fetch queue", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch queue"})
		return
	}

	var queue []map[string]any
	for _, t := range tracks {
		uiStatus := "processing"
		switch t.ProcessingStatus {
		case "pending":
			uiStatus = "queued"
		case "completed":
			uiStatus = "success"
		case "failed":
			uiStatus = "error"
		}

		queue = append(queue, map[string]any{
			"id":       t.ID,
			"title":    t.Title,
			"status":   uiStatus,
			"progress": t.ProcessingProgress,
			"step":     "Acoustic Analysis...",
		})
	}

	if queue == nil {
		queue = make([]map[string]any, 0)
	}

	c.JSON(http.StatusOK, queue)
}

func (h *TrackHandler) Analysis(c *gin.Context) {
	orgID, ok := getOrgID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Organization context missing"})
		return
	}

	id := c.Param("id")
	var track models.Track

	if err := h.db.Where("organization_id = ?", orgID).First(&track, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Track not found"})
		return
	}

	h.db.Model(&track).Updates(map[string]any{
		"processing_status":   "pending",
		"processing_progress": 0,
	})

	redisAddr := fmt.Sprintf("%s:%s", h.config.Redis.Host, h.config.Redis.Port)

	var tlsConf *tls.Config
	if h.config.Redis.TLS {
		tlsConf = &tls.Config{MinVersion: tls.VersionTLS12}
	}

	asynqClient := asynq.NewClient(asynq.RedisClientOpt{
		Addr:      redisAddr,
		Password:  h.config.Redis.Password,
		DB:        h.config.Redis.DB,
		TLSConfig: tlsConf,
	})
	defer asynqClient.Close()

	payloadData := map[string]any{
		"track_id": track.ID,
		"file_key": track.Key,
		"is_retry": true,
	}
	payloadBytes, _ := json.Marshal(payloadData)
	task := asynq.NewTask("track:process", payloadBytes)

	_, err := asynqClient.Enqueue(task)
	if err != nil {
		slog.Error("Failed to re-enqueue job", "error", err)
		h.db.Model(&track).Update("processing_status", "failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to restart analysis queue"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Analysis restarted successfully"})
}
