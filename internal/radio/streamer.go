package radio

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"gorm.io/gorm"

	"momo-radio/internal/audio"
	"momo-radio/internal/config"
	database "momo-radio/internal/db"
	"momo-radio/internal/dj"
	"momo-radio/internal/models"
	"momo-radio/internal/scheduler"
	"momo-radio/internal/storage"
)

// --- METRICS ---
var (
	tracksPlayed = prometheus.NewCounterVec(
		prometheus.CounterOpts{Name: "radio_playout_tracks_total", Help: "Tracks played per tenant"},
		[]string{"organization_id"},
	)
	uploadsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{Name: "radio_hls_uploads_total", Help: "HLS uploads"},
		[]string{"type", "organization_id"},
	)
	uploadDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "radio_hls_upload_duration_seconds",
			Help:    "Upload time",
			Buckets: []float64{0.1, 0.5, 1, 2, 5},
		},
		[]string{"type"},
	)
)

func RegisterMetrics() {
	prometheus.MustRegister(tracksPlayed, uploadsTotal, uploadDuration)
}

// --- ENGINE ---

type Engine struct {
	cfg       *config.Config
	storage   *storage.Client
	db        *database.Client
	runID     int64
	cache     *CacheManager
	state     *StateManager
	scheduler *scheduler.Manager
}

type CurrentTrack struct {
	Artist    string `json:"artist"`
	Title     string `json:"title"`
	Album     string `json:"album"`
	Show      string `json:"show"`
	StartedAt int64  `json:"started_at"`
}

type s3Adapter struct {
	store *storage.Client
}

func (a *s3Adapter) DownloadFile(key string) (io.ReadCloser, error) {
	obj, err := a.store.DownloadFile(key)
	if err != nil {
		return nil, err
	}
	return obj.Body, nil
}

func New(cfg *config.Config, store *storage.Client, db *database.Client) *Engine {
	adapter := &s3Adapter{store: store}

	return &Engine{
		cfg:       cfg,
		storage:   store,
		db:        db,
		runID:     time.Now().Unix(),
		cache:     NewCacheManager(adapter, cfg.Server.TempDir),
		state:     NewStateManager(db.DB),
		scheduler: scheduler.NewManager(db.DB, cfg.Server.Timezone),
	}
}

func (e *Engine) Run() {
	if e.cfg.Radio.DryRun {
		return
	}

	log.Printf("Engine Run ID: %d", e.runID)

	go e.startRedirectServer()

	activeTenants := make(map[uuid.UUID]bool)
	ticker := time.NewTicker(30 * time.Second)

	e.checkAndStartTenants(activeTenants)
	for range ticker.C {
		e.checkAndStartTenants(activeTenants)
	}
}

func (e *Engine) checkAndStartTenants(active map[uuid.UUID]bool) {
	var orgIDs []uuid.UUID
	e.db.DB.Model(&models.Track{}).Distinct("organization_id").Pluck("organization_id", &orgIDs)

	for _, id := range orgIDs {
		if !active[id] {
			active[id] = true
			log.Printf("🚀 Starting broadcast pipeline for Tenant: %s", id)
			go e.runTenantPipeline(id)
		}
	}
}

// ⚡️ runTenantPipeline manages the HLS stream dynamically configured by DB Mount Points
func (e *Engine) runTenantPipeline(orgID uuid.UUID) {
	// 1. Fetch the default initialized mount point for this tenant from DB
	var defaultMount models.MountPoint
	err := e.db.DB.Where("organization_id = ? AND is_default = ?", orgID, true).First(&defaultMount).Error
	if err != nil {
		log.Printf("[%s] No active default mount point found! Skipping transmission infrastructure.", orgID)
		return
	}

	// 2. Prepare an isolated output directory scoped to Tenant ID AND Mount Slug
	segmentDir := filepath.Join(e.cfg.Radio.SegmentDir, orgID.String(), defaultMount.Slug)
	os.RemoveAll(segmentDir)
	os.MkdirAll(segmentDir, 0755)

	// 3. Resume Logic (Scoped to Tenant)
	state, err := e.state.GetCurrentState(orgID)
	startSequence := 0
	var resumeTrackID uint

	if err == nil && time.Since(state.UpdatedAt) < 10*time.Minute {
		log.Printf("[%s] RECOVERED STATE: Resuming sequence %d", orgID, state.Sequence)
		startSequence = state.Sequence + 2
		resumeTrackID = state.TrackID
	}

	// 4. Setup Pipeline Execution
	pr, pw := io.Pipe()

	// A. FFmpeg Consumer passed with segment directory and targeted Mount Bitrate specification
	go audio.StartStreamProcess(pr, e.cfg, e.runID, int64(startSequence), segmentDir, defaultMount.Bitrate)

	// B. Orchestrator Producer
	go e.runOrchestrator(orgID, pw, resumeTrackID)

	// C. Dynamic Mount Uploader
	e.startStreamUploader(orgID, defaultMount.Slug, segmentDir)
}

func getShowName(slot *models.ScheduleSlot) string {
	if slot == nil || slot.ScheduleType == "fallback" {
		return "General Rotation"
	}
	if slot.Playlist != nil {
		return slot.Playlist.Name
	}
	if slot.RuleSet != nil {
		return slot.RuleSet.Name
	}
	return "Momo Radio"
}

func (e *Engine) runOrchestrator(orgID uuid.UUID, output *io.PipeWriter, resumeID uint) {
	defer output.Close()

	selectors := map[string]dj.Selector{
		"random":     dj.NewSelector("random", e.db.DB, orgID),
		"starvation": dj.NewSelector("starvation", e.db.DB, orgID),
	}

	var lastTrack *models.Track
	firstRun := true

	for {
		var selectedTrack *models.Track
		var err error

		if firstRun && resumeID != 0 {
			if dbErr := e.db.DB.Preload("Artists").Where("organization_id = ?", orgID).First(&selectedTrack, resumeID).Error; dbErr == nil {
				lastTrack = selectedTrack
			}
			firstRun = false
		}

		if selectedTrack == nil {
			activeSlot := e.scheduler.GetCurrentSchedule(orgID)

			if activeSlot != nil && activeSlot.PlaylistID != nil {
				selectedTrack, err = e.pickNextFromPlaylist(orgID, *activeSlot.PlaylistID, lastTrack)
			} else if activeSlot != nil && activeSlot.RuleSetID != nil {
				mode := "random"
				if activeSlot.RuleSet != nil && activeSlot.RuleSet.Mode != "" {
					mode = strings.ToLower(activeSlot.RuleSet.Mode)
				}
				selector, exists := selectors[mode]
				if !exists {
					selector = selectors["random"]
				}
				selectedTrack, err = selector.PickTrack(activeSlot.RuleSet, lastTrack)
			}
		}

		if err != nil || selectedTrack == nil {
			selectedTrack, _ = selectors["random"].PickTrack(nil, nil)
		}

		if selectedTrack != nil {
			e.state.UpdateTrack(orgID, selectedTrack.ID, 0)

			e.cache.Prefetch([]string{selectedTrack.Key})
			go e.cache.Cleanup([]string{selectedTrack.Key})

			tracksPlayed.WithLabelValues(orgID.String()).Inc()

			go e.updateNowPlaying(orgID, selectedTrack, getShowName(e.scheduler.GetCurrentSchedule(orgID)))
			go e.recordTrackPlay(orgID, selectedTrack)

			lastTrack = selectedTrack

			if err := e.streamFileToPipe(selectedTrack.Key, output); err != nil {
				log.Printf("[%s] Pipe Stream Error: %v", orgID, err)
				continue
			}
		}
		time.Sleep(100 * time.Millisecond)
	}
}

func (e *Engine) pickNextFromPlaylist(orgID uuid.UUID, playlistID uint, lastTrack *models.Track) (*models.Track, error) {
	var track models.Track
	currentSortOrder := -1

	if lastTrack != nil {
		e.db.DB.Table("playlist_tracks").
			Select("sort_order").
			Where("playlist_id = ? AND track_id = ?", playlistID, lastTrack.ID).
			Scan(&currentSortOrder)
	}

	err := e.db.DB.Model(&models.Track{}).
		Joins("JOIN playlist_tracks ON playlist_tracks.track_id = tracks.id").
		Where("playlist_tracks.playlist_id = ? AND tracks.organization_id = ? AND playlist_tracks.sort_order > ?", playlistID, orgID, currentSortOrder).
		Preload("Artists").
		Preload("Album").
		Order("playlist_tracks.sort_order ASC").
		First(&track).Error

	if err != nil {
		err = e.db.DB.Model(&models.Track{}).
			Joins("JOIN playlist_tracks ON playlist_tracks.track_id = tracks.id").
			Where("playlist_tracks.playlist_id = ? AND tracks.organization_id = ?", playlistID, orgID).
			Preload("Artists").
			Preload("Album").
			Order("playlist_tracks.sort_order ASC").
			First(&track).Error
	}

	return &track, err
}

func (e *Engine) updateNowPlaying(orgID uuid.UUID, t *models.Track, showName string) {
	albumName := ""
	if t.Album.Title != "" {
		albumName = t.Album.Title
	}

	var artistNames []string
	for _, a := range t.Artists {
		artistNames = append(artistNames, a.Name)
	}
	artistStr := "Unknown Artist"
	if len(artistNames) > 0 {
		artistStr = strings.Join(artistNames, ", ")
	}

	trackData := CurrentTrack{
		Title:     t.Title,
		Artist:    artistStr,
		Album:     albumName,
		Show:      showName,
		StartedAt: time.Now().Unix(),
	}

	data, err := json.Marshal(trackData)
	if err != nil {
		return
	}

	destKey := fmt.Sprintf("%s/now_playing.json", orgID.String())
	e.storage.UploadStreamFile(destKey, bytes.NewReader(data), "application/json", "max-age=0, no-cache")
}

func (e *Engine) recordTrackPlay(orgID uuid.UUID, t *models.Track) {
	now := time.Now()
	err := e.db.DB.Transaction(func(tx *gorm.DB) error {
		err := tx.Model(&models.Track{}).
			Where("id = ? AND organization_id = ?", t.ID, orgID).
			Updates(map[string]any{
				"play_count":     gorm.Expr("play_count + 1"),
				"last_played_at": now,
			}).Error
		if err != nil {
			return err
		}

		history := models.PlayHistory{
			OrganizationID: orgID,
			TrackID:        t.ID,
			PlayedAt:       now,
		}
		return tx.Create(&history).Error
	})
	if err != nil {
		log.Printf("[%s] Failed to record play: %v", orgID, err)
	}
}

func (e *Engine) streamFileToPipe(key string, pipe *io.PipeWriter) error {
	localPath, err := e.cache.GetLocalPath(key)
	if err != nil {
		return err
	}

	f, err := os.Open(localPath)
	if err != nil {
		return err
	}
	defer f.Close()

	_, err = io.Copy(pipe, f)
	return err
}

// Scoped Uploader now routes variants using mount parameters
func (e *Engine) startStreamUploader(orgID uuid.UUID, mountSlug string, dir string) {
	ticker := time.NewTicker(800 * time.Millisecond)
	defer ticker.Stop()

	var lastM3u8Time time.Time
	uploadedSegments := make(map[string]bool)
	seqRegex := regexp.MustCompile(`_(\d+)\.ts$`)

	for range ticker.C {
		files, err := os.ReadDir(dir)
		if err != nil {
			continue
		}

		for _, entry := range files {
			filename := entry.Name()
			fullPath := filepath.Join(dir, filename)
			info, err := entry.Info()
			if err != nil {
				continue
			}

			if time.Since(info.ModTime()) < 1*time.Second {
				continue
			}

			if filename == "stream.m3u8" {
				if info.ModTime().After(lastM3u8Time) {
					if err := e.uploadPlaylist(orgID, mountSlug, fullPath, filename); err == nil {
						lastM3u8Time = info.ModTime()
					}
				}
				continue
			}

			if strings.HasSuffix(filename, ".ts") && !uploadedSegments[filename] {
				matches := seqRegex.FindStringSubmatch(filename)
				if len(matches) > 1 {
					if seq, err := strconv.Atoi(matches[1]); err == nil {
						e.state.IncrementSequence(orgID, seq)
					}
				}

				if err := e.uploadSegment(orgID, mountSlug, fullPath, filename); err == nil {
					uploadedSegments[filename] = true
					os.Remove(fullPath)
				}
			}
		}

		if len(uploadedSegments) > 100 {
			e.cleanupUploadedMap(uploadedSegments, dir)
		}
	}
}

func (e *Engine) uploadPlaylist(orgID uuid.UUID, mountSlug string, path, name string) error {
	timer := prometheus.NewTimer(uploadDuration.WithLabelValues("playlist"))
	defer timer.ObserveDuration()

	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()

	// ⚡️ Route target: {tenant_id}/{mount_slug}/stream.m3u8
	destKey := fmt.Sprintf("%s/%s/%s", orgID.String(), mountSlug, name)
	err = e.storage.UploadStreamFile(destKey, f, "application/vnd.apple.mpegurl", "max-age=0, no-cache, no-store, must-revalidate")
	if err == nil {
		uploadsTotal.WithLabelValues("playlist", orgID.String()).Inc()
	}
	return err
}

func (e *Engine) uploadSegment(orgID uuid.UUID, mountSlug string, path, name string) error {
	timer := prometheus.NewTimer(uploadDuration.WithLabelValues("segment"))
	defer timer.ObserveDuration()

	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()

	// Route target: {tenant_id}/{mount_slug}/segment_xxx.ts
	destKey := fmt.Sprintf("%s/%s/%s", orgID.String(), mountSlug, name)
	err = e.storage.UploadStreamFile(destKey, f, "video/MP2T", "public, max-age=86400")
	if err == nil {
		uploadsTotal.WithLabelValues("segment", orgID.String()).Inc()
	}
	return err
}

func (e *Engine) cleanupUploadedMap(m map[string]bool, dir string) {
	for k := range m {
		if _, err := os.Stat(filepath.Join(dir, k)); os.IsNotExist(err) {
			delete(m, k)
		}
	}
}

func (e *Engine) startRedirectServer() {
	endpoint := strings.TrimRight(e.cfg.Storage.Endpoint, "/")
	port := ":8080"

	// E.g. /listen?org_id=uuid&mount=radio
	http.HandleFunc("/listen", func(w http.ResponseWriter, r *http.Request) {
		orgID := r.URL.Query().Get("org_id")
		mount := r.URL.Query().Get("mount")

		if orgID == "" {
			http.Error(w, "Missing org_id parameter", http.StatusBadRequest)
			return
		}
		if mount == "" {
			mount = "radio"
		}

		// Dynamic asset routing redirect to Object Storage / BunnyCDN configuration
		publicURL := fmt.Sprintf("%s/%s/%s/%s/stream.m3u8", endpoint, e.cfg.Storage.BucketStream, orgID, mount)
		http.Redirect(w, r, publicURL, http.StatusFound)
	})

	http.Handle("/_metrics", promhttp.Handler())

	log.Printf("Helper Server listening at %s", port)
	http.ListenAndServe(port, nil)
}
