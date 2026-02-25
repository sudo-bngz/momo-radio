package handlers

import (
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"momo-radio/internal/metadata"
	"momo-radio/internal/models"
	"momo-radio/internal/storage"

	"github.com/bogem/id3v2"
	"github.com/dhowden/tag"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// TrackHandler handles track-related requests and file uploads
type TrackHandler struct {
	db      *gorm.DB
	storage *storage.Client
}

// NewTrackHandler creates a new TrackHandler instance with its required dependencies
func NewTrackHandler(db *gorm.DB, st *storage.Client) *TrackHandler {
	return &TrackHandler{
		db:      db,
		storage: st,
	}
}

// GetTracks returns a paginated list of tracks from the database
// Query Params: page (default 1), limit (default 50), search (optional)
func (h *TrackHandler) GetTracks(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	search := c.Query("search")

	offset := (page - 1) * limit

	var tracks []models.Track
	var total int64

	// Replaced s.db.DB with h.db
	query := h.db.Model(&models.Track{})

	if search != "" {
		// Basic search on artist or title
		searchTerm := "%" + search + "%"
		query = query.Where("artist ILIKE ? OR title ILIKE ?", searchTerm, searchTerm)
	}

	// Count total for pagination metadata
	query.Count(&total)

	// Fetch data
	result := query.Order("created_at desc").Limit(limit).Offset(offset).Find(&tracks)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": tracks,
		"meta": gin.H{
			"page":  page,
			"limit": limit,
			"total": total,
		},
	})
}

// PreAnalyzeFile reads the uploaded file in memory and extracts ID3 tags
// It does NOT upload to S3 or save to DB yet.
func (h *TrackHandler) PreAnalyzeFile(c *gin.Context) {
	// 1. Get File
	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}

	// 2. Open Stream
	file, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Unable to open file"})
		return
	}
	defer file.Close()

	// 3. Extract Metadata
	metadata, err := tag.ReadFrom(file)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"filename": fileHeader.Filename,
			"title":    fileHeader.Filename, // Default fallback
		})
		return
	}

	// 4. Format Response for React Form
	yearStr := ""
	if metadata.Year() != 0 {
		yearStr = strconv.Itoa(metadata.Year())
	}

	c.JSON(http.StatusOK, gin.H{
		"filename": fileHeader.Filename,
		"format":   string(metadata.Format()),
		"title":    metadata.Title(),
		"artist":   metadata.Artist(),
		"album":    metadata.Album(),
		"genre":    metadata.Genre(),
		"year":     yearStr,
	})
}

// UploadTrack processes the file, tags it, and uploads it to cloud storage
func (h *TrackHandler) UploadTrack(c *gin.Context) {
	// 1. Parse File & Form
	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}

	// Capture metadata
	meta := map[string]string{
		"TITLE":  c.PostForm("title"),
		"ARTIST": c.PostForm("artist"),
		"ALBUM":  c.PostForm("album"),
		"GENRE":  c.PostForm("genre"),
		"DATE":   c.PostForm("year"), // FLAC uses DATE
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
	tempFile.Close() // Close to allow tagging

	// 4. STAMP METADATA
	switch ext {
	case ".mp3":
		if err := metadata.StampMP3(tempFile.Name(), meta); err != nil {
			slog.Error("failed to tag mp3", "error", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to tag MP3"})
			return
		}
	case ".flac":
		if err := metadata.StampFLAC(tempFile.Name(), meta); err != nil {
			slog.Error("failed to tag flac", "error", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to tag FLAC"})
			return
		}
	}

	// 5. Upload to S3
	finalFile, err := os.Open(tempFile.Name())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read processed file"})
		return
	}
	defer finalFile.Close()

	b2Key := "incoming/" + filepath.Base(fileHeader.Filename)
	contentType := fileHeader.Header.Get("Content-Type")

	// Replaced s.storage with h.storage
	err = h.storage.UploadIngestFile(b2Key, finalFile, contentType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Storage upload failed"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"status": "queued", "key": b2Key})
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

	// 1. Look up the track in the database
	var track models.Track
	if err := h.db.First(&track, "id = ?", trackID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Track metadata not found"})
		return
	}

	// 2. Fetch the file object via the Storage Abstraction
	obj, err := h.storage.DownloadFile(track.Key)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Audio file missing from storage"})
		return
	}

	// CRITICAL: Always close the storage stream to prevent memory/connection leaks
	defer obj.Body.Close()
	if seeker, ok := obj.Body.(io.ReadSeeker); ok {
		http.ServeContent(c.Writer, c.Request, track.Title, obj.LastModified, seeker)
		return
	}

	// 4. Fallback for non-seekable streams
	extraHeaders := map[string]string{
		"Cache-Control": "public, max-age=31536000",
		"Accept-Ranges": "none", // Explicitly tell the browser it can't seek
	}

	// DataFromReader streams the io.ReadCloser chunk-by-chunk directly to the client
	c.DataFromReader(http.StatusOK, obj.ContentLength, obj.ContentType, obj.Body, extraHeaders)
}
