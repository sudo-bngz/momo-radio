package handlers

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"momo-radio/internal/config"
	"momo-radio/internal/metadata"
	"momo-radio/internal/models"
	"momo-radio/internal/storage"
	"momo-radio/internal/utils"

	"github.com/dhowden/tag"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/hibiken/asynq"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

// TrackHandler handles track-related requests and file uploads
type TrackHandler struct {
	db      *gorm.DB
	storage *storage.Client
	config  *config.Config
	redis   *redis.Client
}

// NewTrackHandler creates a new TrackHandler instance
func NewTrackHandler(db *gorm.DB, st *storage.Client, c *config.Config, redisClient *redis.Client) *TrackHandler {
	return &TrackHandler{
		db:      db,
		storage: st,
		config:  c,
		redis:   redisClient,
	}
}

// LibraryTrack prevents sending massive payloads
type LibraryTrack struct {
	ID         uint    `json:"id"`
	Title      string  `json:"title"`
	Artist     string  `json:"artist"`
	Album      string  `json:"album"`
	Duration   float64 `json:"duration"`
	CoverURL   string  `json:"cover_url"`
	BPM        float64 `json:"bpm"`
	MusicalKey string  `json:"musical_key"`
	Scale      string  `json:"scale"`
	Style      string  `json:"style"`
	Status     string  `json:"status"`
}

// ⚡️ Safely extract Organization ID from Gin Context
func getOrgID(c *gin.Context) (uuid.UUID, bool) {
	orgIDRaw, exists := c.Get("organizationID")
	if !exists {
		return uuid.Nil, false
	}
	orgID, ok := orgIDRaw.(uuid.UUID)
	return orgID, ok
}

// GetTracks returns a paginated, lightweight list of tracks scoped by Tenant
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

	if limit > 200 {
		limit = 200
	}

	// 1. Build the base query, PRELOAD, and ⚡️ SCOPE TO TENANT
	// Changed "Artist" to "Artists" for Many-to-Many
	query := h.db.Model(&models.Track{}).
		Preload("Artists").
		Preload("Album").
		Where("tracks.organization_id = ?", orgID)

	// 2. Apply Search
	// Safely search Many-to-Many using EXISTS to prevent duplicate row counts
	if search != "" {
		searchTerm := "%" + search + "%"
		query = query.Where(
			"tracks.title ILIKE ? OR EXISTS (SELECT 1 FROM track_artists ta JOIN artists a ON a.id = ta.artist_id WHERE ta.track_id = tracks.id AND a.name ILIKE ?)",
			searchTerm, searchTerm,
		)
	}

	// 3. Get Total Count
	var total int64
	query.Count(&total)

	// 4. Apply Sorting
	switch sortBy {
	case "alphabetical":
		query = query.Order("tracks.title ASC")
	case "duration":
		query = query.Order("tracks.duration DESC")
	default:
		query = query.Order("tracks.id DESC")
	}

	// 5. Fetch Models
	var tracks []models.Track
	result := query.Limit(limit).Offset(offset).Find(&tracks)

	if result.Error != nil {
		slog.Error("Failed to fetch tracks", "error", result.Error)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	var libraryTracks []LibraryTrack
	for _, t := range tracks {
		// Join multiple artists together into a single string for the UI
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
			coverURL = h.storage.GetPublicURL(t.Album.CoverKey)
		}

		libraryTracks = append(libraryTracks, LibraryTrack{
			ID:         t.ID,
			Title:      t.Title,
			Artist:     artistStr, // Pushed the joined string here
			Album:      t.Album.Title,
			Duration:   t.Duration,
			CoverURL:   coverURL,
			BPM:        t.BPM,
			MusicalKey: t.MusicalKey,
			Scale:      t.Scale,
			Style:      t.Style,
			Status:     t.ProcessingStatus,
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

// GetTrack returns the FULL metadata for a single track
func (h *TrackHandler) GetTrack(c *gin.Context) {
	orgID, ok := getOrgID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Organization context missing"})
		return
	}

	id := c.Param("id")
	var track models.Track

	// Scope to Tenant and Preload Artists array
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

// UpdateTrack scopes the update query to the specific organization
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
	delete(updateData, "organization_id") // Prevent malicious tenant reassignment

	// ⚡️ Scope to Tenant
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

// PreAnalyzeFile extracts local ID3 tags and splits the artist string
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

// UploadTrack creates Artists, Albums, and Tracks strictly attached to the Tenant
func (h *TrackHandler) UploadTrack(c *gin.Context) {
	orgID, ok := getOrgID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Organization context missing"})
		return
	}

	// 1. Parse File & Form
	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}

	meta := map[string]string{
		"TITLE":  c.PostForm("title"),
		"ARTIST": c.PostForm("artist"),
		"ALBUM":  c.PostForm("album"),
		"GENRE":  c.PostForm("genre"),
		"DATE":   c.PostForm("year"),
		"BPM":    c.PostForm("bpm"),
		"KEY":    c.PostForm("key"),
	}

	// 2. Create Temp File
	ext := strings.ToLower(filepath.Ext(fileHeader.Filename))
	tempFile, err := os.CreateTemp("", "momo-upload-*"+ext)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server storage error"})
		return
	}
	defer os.Remove(tempFile.Name())

	// 3. Copy Stream
	uploadedFile, err := fileHeader.Open()
	if err != nil {
		tempFile.Close()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "File open error"})
		return
	}
	io.Copy(tempFile, uploadedFile)
	uploadedFile.Close()
	tempFile.Close()

	// 4. STAMP METADATA
	switch ext {
	case ".mp3":
		if err := metadata.StampMP3(tempFile.Name(), meta); err != nil {
			slog.Error("failed to tag mp3", "error", err)
		}
	case ".flac":
		if err := metadata.StampFLAC(tempFile.Name(), meta); err != nil {
			slog.Error("failed to tag flac", "error", err)
		}
	}

	// 5. Upload Main Audio File
	finalFile, err := os.Open(tempFile.Name())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read processed file"})
		return
	}
	defer finalFile.Close()

	safeFilename := strings.ReplaceAll(filepath.Base(fileHeader.Filename), " ", "_")
	b2Key := fmt.Sprintf("incoming/%s/%d_%s", orgID.String(), time.Now().Unix(), safeFilename)
	contentType := fileHeader.Header.Get("Content-Type")

	err = h.storage.UploadIngestFile(b2Key, finalFile, contentType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Storage upload failed"})
		return
	}

	// 6. ⚡️ Resolve Initial Artist (Scoped to Organization)
	// The pipeline worker will refine this later, but we need an initial record
	artistName := strings.TrimSpace(c.PostForm("artist"))
	if artistName == "" {
		artistName = "Unknown Artist"
	}
	var artist models.Artist
	h.db.Where("name = ? AND organization_id = ?", artistName, orgID).
		FirstOrCreate(&artist, models.Artist{Name: artistName, OrganizationID: orgID})

	// 7. Resolve Album (Scoped to Organization)
	albumTitle := strings.TrimSpace(c.PostForm("album"))
	var album models.Album
	var albumIDPtr *uint

	if albumTitle != "" {
		h.db.Where("title = ? AND artist_id = ? AND organization_id = ?", albumTitle, artist.ID, orgID).
			FirstOrCreate(&album, models.Album{Title: albumTitle, ArtistID: artist.ID, OrganizationID: orgID})

		albumUpdates := map[string]any{}
		if label := strings.TrimSpace(c.PostForm("label")); label != "" {
			albumUpdates["Publisher"] = label
		}
		if cat := strings.TrimSpace(c.PostForm("catalog_number")); cat != "" {
			albumUpdates["CatalogNumber"] = cat
		}
		if country := strings.TrimSpace(c.PostForm("country")); country != "" {
			albumUpdates["ReleaseCountry"] = country
		}
		if year := strings.TrimSpace(c.PostForm("year")); year != "" {
			albumUpdates["Year"] = year
		}

		// EXTRACT COVER
		if album.CoverKey == "" {
			f, _ := os.Open(tempFile.Name())
			m, tagErr := tag.ReadFrom(f)
			f.Close()

			if tagErr == nil && m.Picture() != nil {
				pic := m.Picture()
				picExt := pic.Ext
				if picExt == "" {
					picExt = "jpg"
				}

				coverKey := fmt.Sprintf("covers/%s/album_%d.%s", orgID.String(), album.ID, picExt)
				uploadErr := h.storage.UploadAssetFile(coverKey, bytes.NewReader(pic.Data), pic.MIMEType, "public, max-age=31536000")
				if uploadErr == nil {
					albumUpdates["CoverKey"] = coverKey
				}
			}
		}

		if len(albumUpdates) > 0 {
			h.db.Model(&album).Updates(albumUpdates)
		}
		albumIDPtr = &album.ID
	}

	// 8. Create Track DB Row using Many-to-Many Array
	newTrack := models.Track{
		OrganizationID:     orgID,
		Title:              c.PostForm("title"),
		Artists:            []models.Artist{artist}, // Assigned via array now!
		AlbumID:            albumIDPtr,
		Genre:              c.PostForm("genre"),
		Key:                b2Key,
		MasterKey:          b2Key,
		ProcessingStatus:   "pending",
		ProcessingProgress: 0,
	}

	if err := h.db.Create(&newTrack).Error; err != nil {
		slog.Error("Failed to create track DB record", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database insert failed"})
		return
	}

	// 9. Enqueue the Asynq Job
	redisAddr := fmt.Sprintf("%s:%s", h.config.Redis.Host, h.config.Redis.Port)
	asynqClient := asynq.NewClient(asynq.RedisClientOpt{
		Addr:     redisAddr,
		Password: h.config.Redis.Password,
		DB:       h.config.Redis.DB,
	})
	defer asynqClient.Close()

	payloadData := map[string]any{
		"track_id": newTrack.ID,
		"file_key": b2Key,
	}
	payloadBytes, _ := json.Marshal(payloadData)
	task := asynq.NewTask("track:process", payloadBytes)

	_, err = asynqClient.Enqueue(task)
	if err != nil {
		h.db.Model(&newTrack).Update("processing_status", "failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to queue processing job"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"status":   "queued",
		"message":  "Upload successful, processing started.",
		"track_id": newTrack.ID,
		"key":      b2Key,
	})
}

// StreamTrack ensures the user actually owns the file they are trying to stream
func (h *TrackHandler) StreamTrack(c *gin.Context) {
	orgID, ok := getOrgID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Organization context missing"})
		return
	}

	trackID := c.Param("id")
	var track models.Track

	// ⚡️ Scope to Tenant
	if err := h.db.Where("organization_id = ?", orgID).First(&track, "id = ?", trackID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Track metadata not found or unauthorized"})
		return
	}

	obj, err := h.storage.DownloadFile(track.Key)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Audio file missing from storage"})
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

// TrackStatusStream validates ownership before subscribing to Redis
func (h *TrackHandler) TrackStatusStream(c *gin.Context) {
	orgID, ok := getOrgID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Organization context missing"})
		return
	}

	trackID := c.Param("id")

	// ⚡️ Prevent users from spying on other organizations' processing streams
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

// GetQueue fetches recent processing jobs scoped to the tenant
func (h *TrackHandler) GetQueue(c *gin.Context) {
	orgID, ok := getOrgID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Organization context missing"})
		return
	}

	var tracks []models.Track

	// Scope to Tenant
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

	// Always return an array to avoid null responses causing React mapping errors
	if queue == nil {
		queue = make([]map[string]any, 0)
	}

	c.JSON(http.StatusOK, queue)
}

// Analysis safely restarts processing for a tenant-owned track
func (h *TrackHandler) Analysis(c *gin.Context) {
	orgID, ok := getOrgID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Organization context missing"})
		return
	}

	id := c.Param("id")
	var track models.Track

	// ⚡️ Scope to Tenant
	if err := h.db.Where("organization_id = ?", orgID).First(&track, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Track not found"})
		return
	}

	// 1. Reset status
	h.db.Model(&track).Updates(map[string]any{
		"processing_status":   "pending",
		"processing_progress": 0,
	})

	// 2. Queue Job
	redisAddr := fmt.Sprintf("%s:%s", h.config.Redis.Host, h.config.Redis.Port)
	asynqClient := asynq.NewClient(asynq.RedisClientOpt{
		Addr:     redisAddr,
		Password: h.config.Redis.Password,
		DB:       h.config.Redis.DB,
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
