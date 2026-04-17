package handlers

import (
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
	"gorm.io/gorm"
)

// TrackHandler handles track-related requests and file uploads
type TrackHandler struct {
	db      *gorm.DB
	storage *storage.Client
	config  *config.Config
}

// NewTrackHandler creates a new TrackHandler instance with its required dependencies
func NewTrackHandler(db *gorm.DB, st *storage.Client, c *config.Config) *TrackHandler {
	return &TrackHandler{
		db:      db,
		storage: st,
		config:  c,
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

		// 1. Declare the variable outside with a default value
		var coverURL string

		// 2. Assign to it (use = instead of :=)
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
		})
	}

	// If no tracks are found, return an empty array instead of null
	if libraryTracks == nil {
		libraryTracks = []LibraryTrack{}
	}

	// 7. Return Response
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

	// Protect read-only fields from being modified via the API
	delete(updateData, "id")
	delete(updateData, "key")
	delete(updateData, "duration")
	delete(updateData, "file_size")

	// Perform the update
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
