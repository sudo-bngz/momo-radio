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

	"momo-radio/internal/config"
	"momo-radio/internal/metadata"
	"momo-radio/internal/models"
	"momo-radio/internal/storage"

	"github.com/bogem/id3v2"
	"github.com/dhowden/tag"
	"github.com/gin-gonic/gin"
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

// NewTrackHandler creates a new TrackHandler instance with its required dependencies
func NewTrackHandler(db *gorm.DB, st *storage.Client, c *config.Config, redisClient *redis.Client) *TrackHandler {
	return &TrackHandler{
		db:      db,
		storage: st,
		config:  c,
		redis:   redisClient,
	}
}

// LibraryTrack prevents sending massive payloads, now including Album data!
type LibraryTrack struct {
	ID       uint    `json:"id"`
	Title    string  `json:"title"`
	Artist   string  `json:"artist"`
	Album    string  `json:"album"`
	Duration float64 `json:"duration"`
	CoverURL string  `json:"cover_url"`
	BPM      float64 `json:"bpm"`
	Style    string  `json:"style"`
	Status   string  `json:"status"`
}

// GetTracks returns a paginated, lightweight list of tracks using DTO mapping
func (h *TrackHandler) GetTracks(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	search := c.Query("search")
	sortBy := c.DefaultQuery("sort", "newest")

	if limit > 200 {
		limit = 200
	}

	// 1. Build the base query and PRELOAD the relational data
	query := h.db.Model(&models.Track{}).
		Preload("Artist").
		Preload("Album")

	// 2. Apply Search (We use LEFT JOIN so we can filter by the artist's name)
	if search != "" {
		searchTerm := "%" + search + "%"
		query = query.
			Joins("LEFT JOIN artists ON artists.id = tracks.artist_id").
			Where("artists.name ILIKE ? OR tracks.title ILIKE ?", searchTerm, searchTerm)
	}

	// 3. Get Total Count for UI pagination
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

	// 5. Fetch the actual database models
	var tracks []models.Track
	result := query.Limit(limit).Offset(offset).Find(&tracks)

	if result.Error != nil {
		slog.Error("Failed to fetch tracks", "error", result.Error)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	var libraryTracks []LibraryTrack

	for _, t := range tracks {
		artistName := "Unknown Artist"
		if t.Artist.Name != "" {
			artistName = t.Artist.Name
		}

		var coverURL string

		if t.Album.ID != 0 && t.Album.CoverKey != "" {
			coverURL = h.storage.GetPublicURL(t.Album.CoverKey)
		}

		libraryTracks = append(libraryTracks, LibraryTrack{
			ID:       t.ID,
			Title:    t.Title,
			Artist:   artistName,
			Album:    t.Album.Title,
			Duration: t.Duration,
			CoverURL: coverURL,
			BPM:      t.BPM,
			Style:    t.Style,
			Status:   t.ProcessingStatus,
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
	id := c.Param("id")

	var track models.Track
	if err := h.db.Preload("Artist").Preload("Album").First(&track, id).Error; err != nil {
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

	result := h.db.Model(&models.Track{}).Where("id = ?", id).Updates(updateData)
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
		})
		return
	}

	var coverBase64 string
	if pic := metadata.Picture(); pic != nil {
		fmt.Println("titi")
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
		"artist":       metadata.Artist(),
		"album":        metadata.Album(),
		"genre":        metadata.Genre(),
		"year":         yearStr,
		"cover_base64": coverBase64,
	})
}

// UploadTrack processes the file, tags it, uploads to ingest bucket, creates DB row, and dispatches Asynq job.
// UploadTrack processes the file, tags it, extracts embedded covers, uploads to ingest bucket, creates DB rows, and dispatches Asynq job.
func (h *TrackHandler) UploadTrack(c *gin.Context) {
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
	defer tempFile.Close()

	// 3. Copy Stream
	uploadedFile, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "File open error"})
		return
	}
	defer uploadedFile.Close()
	io.Copy(tempFile, uploadedFile)
	tempFile.Close()

	// 4. STAMP METADATA (Optional: Ensures the file has the user's manual edits before uploading)
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

	// 5. Upload Main Audio File to Ingest Bucket
	finalFile, err := os.Open(tempFile.Name())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read processed file"})
		return
	}
	defer finalFile.Close()

	b2Key := "incoming/" + filepath.Base(fileHeader.Filename)
	contentType := fileHeader.Header.Get("Content-Type")

	err = h.storage.UploadIngestFile(b2Key, finalFile, contentType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Storage upload failed"})
		return
	}

	// 6. Resolve Artist
	artistName := strings.TrimSpace(c.PostForm("artist"))
	if artistName == "" {
		artistName = "Unknown Artist"
	}

	var artist models.Artist
	h.db.Where(models.Artist{Name: artistName}).FirstOrCreate(&artist)

	// 7. Resolve Album & Extract Embedded Cover Art
	albumTitle := strings.TrimSpace(c.PostForm("album"))
	var album models.Album
	var albumIDPtr *uint // Defaults to nil (NULL in DB) for Singles

	if albumTitle != "" {
		h.db.Where(models.Album{Title: albumTitle, ArtistID: artist.ID}).FirstOrCreate(&album)

		albumUpdates := map[string]any{}

		// Map Release Info from React
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

		// LOCAL COVER EXTRACTION
		if album.CoverKey == "" {
			f, _ := os.Open(tempFile.Name())
			m, tagErr := tag.ReadFrom(f)
			f.Close()

			if tagErr == nil && m.Picture() != nil {
				pic := m.Picture()

				picExt := pic.Ext
				if picExt == "" {
					picExt = "jpg" // Fallback
				}

				coverKey := fmt.Sprintf("covers/album_%d.%s", album.ID, picExt)

				// ⚡️ FIXED: Upload directly to the public ASSETS bucket!
				uploadErr := h.storage.UploadAssetFile(
					coverKey,
					bytes.NewReader(pic.Data),
					pic.MIMEType,
					"public, max-age=31536000",
				)

				if uploadErr == nil {
					albumUpdates["CoverKey"] = coverKey
				} else {
					slog.Error("Failed to upload embedded cover to assets", "error", uploadErr)
				}
			}
		}
		// Apply updates to the DB
		if len(albumUpdates) > 0 {
			h.db.Model(&album).Updates(albumUpdates)
		}

		// Point our variable to the memory address of the album ID so we can link the track
		albumIDPtr = &album.ID
	}

	// 8. ⚡️ Create Initial "Pending" Track DB Row
	newTrack := models.Track{
		Title:              c.PostForm("title"),
		ArtistID:           artist.ID,
		AlbumID:            albumIDPtr, // Will be NULL if albumTitle was empty
		Genre:              c.PostForm("genre"),
		Key:                b2Key,
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

	// Pass track_id so the worker knows what to analyze
	payloadData := map[string]interface{}{
		"track_id": newTrack.ID,
		"file_key": b2Key,
	}
	payloadBytes, _ := json.Marshal(payloadData)
	task := asynq.NewTask("track:process", payloadBytes)

	_, err = asynqClient.Enqueue(task)
	if err != nil {
		slog.Error("Failed to enqueue job", "error", err)
		h.db.Model(&newTrack).Update("processing_status", "failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to queue processing job"})
		return
	}

	// 10. ⚡️ Return success and Track ID to React for the SSE Stream
	c.JSON(http.StatusCreated, gin.H{
		"status":   "queued",
		"message":  "Upload successful, processing started.",
		"track_id": newTrack.ID,
		"key":      b2Key,
	})
}

// --- Helper Functions ---

func stampMP3(path, title, artist, album, genre, year, bpm, key string) error {
	tag, err := id3v2.Open(path, id3v2.Options{Parse: true})
	if err != nil {
		return err
	}
	defer tag.Close()

	tag.SetTitle(title)
	tag.SetArtist(artist)
	tag.SetAlbum(album)
	tag.SetGenre(genre)
	tag.SetYear(year)

	if bpm != "" {
		tag.AddTextFrame("TBPM", tag.DefaultEncoding(), bpm)
	}
	if key != "" {
		tag.AddTextFrame("TKEY", tag.DefaultEncoding(), key)
	}

	return tag.Save()
}

// StreamTrack streams the audio file using the storage abstraction
func (h *TrackHandler) StreamTrack(c *gin.Context) {
	trackID := c.Param("id")

	var track models.Track
	if err := h.db.First(&track, "id = ?", trackID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Track metadata not found"})
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

// TrackStatusStream is the SSE endpoint.
func (h *TrackHandler) TrackStatusStream(c *gin.Context) {
	trackID := c.Param("id")

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

// GetQueue returns the recent ingestion queue for the UI
func (h *TrackHandler) GetQueue(c *gin.Context) {
	var tracks []models.Track

	// This captures pending, processing, failed, and newly completed tracks.
	err := h.db.Order("created_at DESC").Limit(100).Find(&tracks).Error

	if err != nil {
		slog.Error("Failed to fetch queue", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch queue"})
		return
	}

	var queue []map[string]any
	for _, t := range tracks {
		// Map DB's processing_status to the UI's expected status types
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

	c.JSON(http.StatusOK, queue)
}
