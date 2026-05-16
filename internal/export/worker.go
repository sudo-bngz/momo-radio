package export

import (
	"archive/zip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/hibiken/asynq"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/redis/go-redis/v9"

	"momo-radio/internal/config"
	database "momo-radio/internal/db"
	"momo-radio/internal/models"
	"momo-radio/internal/service/m3u"
	"momo-radio/internal/storage"
)

// --- METRICS ---
var (
	jobs = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "radio_export_jobs_total",
			Help: "Total export jobs",
		},
		[]string{"status", "type"},
	)
	duration = prometheus.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "radio_export_duration_seconds",
			Help:    "Processing time for exports",
			Buckets: prometheus.DefBuckets,
		},
	)
)

func RegisterMetrics() {
	prometheus.MustRegister(jobs, duration)
}

// --- ASYNQ DEFINITIONS ---
const TypeExportPlaylist = "playlist:export:m3u"

type PlaylistExportPayload struct {
	PlaylistID     uint   `json:"playlist_id"`
	UserID         uint   `json:"user_id"`
	OrganizationID string `json:"organization_id"`
}

// --- WORKER ---
type Worker struct {
	cfg     *config.Config
	storage *storage.Client
	db      *database.Client
	redis   *redis.Client
}

func New(cfg *config.Config, store *storage.Client, db *database.Client, redisClient *redis.Client) *Worker {
	return &Worker{
		cfg:     cfg,
		storage: store,
		db:      db,
		redis:   redisClient,
	}
}

// HandlePlaylistExportTask executes the zip building pipeline
func (w *Worker) HandlePlaylistExportTask(ctx context.Context, t *asynq.Task) error {
	timer := prometheus.NewTimer(duration)
	defer timer.ObserveDuration()

	var payload PlaylistExportPayload
	if err := json.Unmarshal(t.Payload(), &payload); err != nil {
		log.Printf("Task Failed: Failed to parse payload: %v", err)
		return fmt.Errorf("failed to parse payload: %v", err)
	}

	log.Printf("Starting M3U Export for Playlist %d", payload.PlaylistID)

	// Updates Frontend via Redis SSE
	updateStatus := func(status string, progress int, downloadURL string) {
		msg := map[string]any{
			"status":       status,
			"progress":     progress,
			"download_url": downloadURL,
		}
		jsonMsg, _ := json.Marshal(msg)
		channel := fmt.Sprintf("export_status:user_%d:playlist_%d", payload.UserID, payload.PlaylistID)
		w.redis.Publish(ctx, channel, jsonMsg)
	}

	updateStatus("gathering_data", 5, "")

	// 1. Fetch Data
	var playlist models.Playlist
	err := w.db.DB.Preload("Tracks.Artists").Preload("Tracks.Album").
		Where("id = ? AND organization_id = ?", payload.PlaylistID, payload.OrganizationID).
		First(&playlist).Error

	if err != nil {
		updateStatus("failed", 0, "")
		jobs.WithLabelValues("failure", "m3u").Inc()
		return fmt.Errorf("failed to fetch playlist or unauthorized: %v", err)
	}

	// 2. Setup Staging Directory
	tempDir := filepath.Join(w.cfg.Server.TempDir, fmt.Sprintf("m3u_export_%d_%d", payload.PlaylistID, time.Now().Unix()))
	if err := os.MkdirAll(tempDir, 0755); err != nil {
		jobs.WithLabelValues("failure", "m3u").Inc()
		return fmt.Errorf("failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// 3. Download Audio
	for i, track := range playlist.Tracks {
		if track.Key == "" {
			continue
		}

		progress := 10 + int((float64(i)/float64(len(playlist.Tracks)))*50)
		updateStatus("downloading_audio", progress, "")

		localPath := filepath.Join(tempDir, filepath.Base(track.Key))
		obj, err := w.storage.DownloadFile(track.Key)
		if err != nil {
			log.Printf("Warning: Could not download track %d: %v", track.ID, err)
			continue
		}

		outFile, err := os.Create(localPath)
		if err == nil {
			io.Copy(outFile, obj.Body)
			outFile.Close()
		}
		obj.Body.Close()
	}

	// 4. Generate M3U File
	updateStatus("generating_playlist", 70, "")
	m3uBytes := m3u.Generate(playlist.Tracks) // ⚡️ Generates the EXTM3U format

	// Ensure safe filename for the playlist
	safePlaylistName := filepath.Base(playlist.Name)
	if safePlaylistName == "." || safePlaylistName == "/" {
		safePlaylistName = fmt.Sprintf("Playlist_%d", playlist.ID)
	}
	m3uPath := filepath.Join(tempDir, safePlaylistName+".m3u")

	err = os.WriteFile(m3uPath, m3uBytes, 0644)
	if err != nil {
		updateStatus("failed", 0, "")
		jobs.WithLabelValues("failure", "m3u").Inc()
		return fmt.Errorf("failed to save M3U file: %v", err)
	}

	// 5. Zip Everything Up
	updateStatus("compressing", 80, "")
	zipFileName := fmt.Sprintf("%s.zip", safePlaylistName)
	zipPath := filepath.Join(w.cfg.Server.TempDir, fmt.Sprintf("final_export_%d.zip", payload.PlaylistID))
	defer os.Remove(zipPath)

	zipFile, _ := os.Create(zipPath)
	zipWriter := zip.NewWriter(zipFile)

	filepath.Walk(tempDir, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return err
		}
		header, _ := zip.FileInfoHeader(info)
		header.Name = info.Name()
		header.Method = zip.Deflate
		writer, _ := zipWriter.CreateHeader(header)
		fileToZip, _ := os.Open(path)
		defer fileToZip.Close()
		io.Copy(writer, fileToZip)
		return nil
	})

	zipWriter.Close()
	zipFile.Close()

	// 6. Upload Zip
	updateStatus("uploading_zip", 90, "")
	finalZipReader, _ := os.Open(zipPath)
	defer finalZipReader.Close()

	b2ExportKey := fmt.Sprintf("exports/%s/playlist_%d/%s", payload.OrganizationID, payload.PlaylistID, zipFileName)
	err = w.storage.UploadAssetFile(b2ExportKey, finalZipReader, "application/zip", "public, max-age=86400")
	if err != nil {
		updateStatus("failed", 0, "")
		jobs.WithLabelValues("failure", "m3u").Inc()
		return fmt.Errorf("failed to upload zip: %v", err)
	}

	// 7. Complete
	downloadURL := w.storage.GetPublicURL(b2ExportKey)
	updateStatus("completed", 100, downloadURL)
	jobs.WithLabelValues("success", "m3u").Inc()
	log.Printf("Job Completed: M3U Export %s", downloadURL)

	return nil
}
