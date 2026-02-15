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

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"gorm.io/gorm"

	"momo-radio/internal/audio"
	"momo-radio/internal/config"
	database "momo-radio/internal/db"
	"momo-radio/internal/models"
	"momo-radio/internal/scheduler"
	"momo-radio/internal/storage"

	"momo-radio/internal/dj"
)

// --- METRICS ---
var (
	tracksPlayed = prometheus.NewCounter(
		prometheus.CounterOpts{Name: "radio_playout_tracks_total", Help: "Tracks played"},
	)
	uploadsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{Name: "radio_hls_uploads_total", Help: "HLS uploads"},
		[]string{"type"},
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

// CurrentTrack represents the metadata sent to the frontend
type CurrentTrack struct {
	Artist    string `json:"artist"`
	Title     string `json:"title"`
	Album     string `json:"album"`
	Show      string `json:"show"` // The active radio program
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
		scheduler: scheduler.NewManager(db.DB),
	}
}

func (e *Engine) Run() {
	if e.cfg.Radio.DryRun {
		e.runSimulation()
		return
	}

	log.Printf("🆔 Engine Run ID: %d", e.runID)

	// 1. Prepare output dir
	os.RemoveAll(e.cfg.Radio.SegmentDir)
	os.MkdirAll(e.cfg.Radio.SegmentDir, 0755)

	// 2. Resume Logic
	state, err := e.state.GetCurrentState()
	startSequence := 0
	var resumeTrackID uint

	if err == nil && time.Since(state.UpdatedAt) < 10*time.Minute {
		log.Printf("🔄 RECOVERED STATE: Resuming HLS sequence at %d", state.Sequence)
		startSequence = state.Sequence + 2
		resumeTrackID = state.TrackID
	}

	// 3. Setup Pipeline
	pr, pw := io.Pipe()

	// A. FFmpeg Consumer (The Audio Engine)
	go audio.StartStreamProcess(pr, e.cfg, e.runID, int64(startSequence))

	// B. Orchestrator Producer (The Decision Maker)
	go e.runOrchestrator(pw, resumeTrackID)

	// C. Helper Server & Uploader
	go e.startRedirectServer()
	e.startStreamUploader()
}

// runOrchestrator is the main producer loop.
// It bridges the Clock (Scheduler) with the DJ (Selector).
func (e *Engine) runOrchestrator(output *io.PipeWriter, resumeID uint) {
	defer output.Close()

	// 1. Initialize our Selection Strategies
	// We use a map for quick lookups based on the "mode" string
	selectors := map[string]dj.Selector{
		"random":     dj.NewSelector("random", e.db.DB),
		"starvation": dj.NewSelector("starvation", e.db.DB),
	}

	// 2. Track internal state for selection logic
	var lastTrack *models.Track
	firstRun := true

	log.Println("🚀 Orchestrator started: System is live.")

	for {
		var selectedTrack *models.Track
		var err error

		// --- STEP A: HANDLE RESUME (Cold Start) ---
		if firstRun && resumeID != 0 {
			if dbErr := e.db.DB.First(&selectedTrack, resumeID).Error; dbErr == nil {
				log.Printf("🔙 Resume: Found interrupted track ID %d", resumeID)
				lastTrack = selectedTrack
			}
			firstRun = false
		}

		// --- STEP B: SELECTION LOGIC ---
		if selectedTrack == nil {
			// Ask the Scheduler: "What should be on air at this exact second?"
			activeSlot := e.scheduler.GetCurrentSchedule()

			// Decide based on the Schedule Target type (Playlist vs Ruleset)
			if activeSlot.PlaylistID != nil {
				// MODE: Fixed Sequence
				selectedTrack, err = e.pickNextFromPlaylist(*activeSlot.PlaylistID)
				log.Printf("📋 Mode: Fixed Playlist [%s]", activeSlot.Name)
			} else if activeSlot.RuleSet != nil {
				// MODE: Intelligent AutoDJ
				mode := strings.ToLower(activeSlot.RuleSet.Mode)
				if mode == "" {
					mode = "random" // Default fallback
				}

				selector, exists := selectors[mode]
				if !exists {
					selector = selectors["random"]
				}

				log.Printf("🤖 Mode: AutoDJ (%s) | Ruleset: %s", selector.Name(), activeSlot.RuleSet.Name)

				// Pass the lastTrack to allow Harmonic/Starvation logic to work
				selectedTrack, err = selector.PickTrack(activeSlot.RuleSet, lastTrack)
			}
		}

		// --- STEP C: EMERGENCY FAIL-SAFE ---
		// If the rules are too strict and no track matches, we pick anything random.
		if err != nil || selectedTrack == nil {
			log.Printf("⚠️ Selection Error: %v. Triggering emergency random fallback.", err)
			selectedTrack, _ = selectors["random"].PickTrack(nil, nil)
		}

		// --- STEP D: PLAYOUT EXECUTION ---
		if selectedTrack != nil {
			// 1. Update global stream state (for recovery/frontend)
			e.state.UpdateTrack(selectedTrack.ID, 0)

			// 2. Manage Cache (Prefetch this track, cleanup old ones)
			e.cache.Prefetch([]string{selectedTrack.Key})
			go e.cache.Cleanup([]string{selectedTrack.Key})

			// 3. Metadata & Stats
			log.Printf("▶️  NOW PLAYING: %s - %s", selectedTrack.Artist, selectedTrack.Title)
			tracksPlayed.Inc()

			// Update the now_playing.json for the frontend
			go e.updateNowPlaying(selectedTrack, e.scheduler.GetCurrentSchedule().Name)

			// Record in DB (increments play_count and updates last_played_at)
			go e.recordTrackPlay(selectedTrack)

			// 4. Update internal state for the NEXT loop iteration
			lastTrack = selectedTrack

			// 5. Stream Audio: This blocks until the file is fully copied to FFmpeg
			if err := e.streamFileToPipe(selectedTrack.Key, output); err != nil {
				log.Printf("❌ Pipe Stream Error: %v (Skipping track)", err)
				continue
			}
		}

		// Small safety sleep to prevent infinite tight loops if errors occur rapidly
		time.Sleep(100 * time.Millisecond)
	}
}

// pickNextFromPlaylist finds the next track in a fixed playlist sequence
func (e *Engine) pickNextFromPlaylist(playlistID uint) (*models.Track, error) {
	var track models.Track
	// Logic: Find the track in this playlist with the oldest 'last_played_at'
	err := e.db.DB.Table("tracks").
		Joins("JOIN playlist_tracks ON playlist_tracks.track_id = tracks.id").
		Where("playlist_tracks.playlist_id = ?", playlistID).
		Order("tracks.last_played_at ASC").
		First(&track).Error
	return &track, err
}

func (e *Engine) updateNowPlaying(t *models.Track, showName string) {
	trackData := CurrentTrack{
		Title:     t.Title,
		Artist:    t.Artist,
		Album:     t.Album,
		Show:      showName,
		StartedAt: time.Now().Unix(),
	}

	data, _ := json.Marshal(trackData)
	e.storage.UploadStreamFile("now_playing.json",
		bytes.NewReader(data),
		"application/json",
		"max-age=0, no-cache")
}

func (e *Engine) recordTrackPlay(t *models.Track) {
	now := time.Now()

	// 1. Use a Transaction to ensure both update and history are atomic
	err := e.db.DB.Transaction(func(tx *gorm.DB) error {

		// Update Track stats
		// We use last_played_at to match our Starvation Selector's logic
		err := tx.Model(&models.Track{}).
			Where("id = ?", t.ID).
			Updates(map[string]any{
				"play_count":     gorm.Expr("play_count + 1"),
				"last_played_at": now,
			}).Error
		if err != nil {
			return err
		}

		// Insert History Record
		history := models.PlayHistory{
			TrackID:  t.ID,
			PlayedAt: now,
		}
		if err := tx.Create(&history).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		log.Printf("⚠️  Failed to record play for track %d: %v", t.ID, err)
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

func (e *Engine) startStreamUploader() {
	ticker := time.NewTicker(800 * time.Millisecond)
	defer ticker.Stop()

	var lastM3u8Time time.Time
	uploadedSegments := make(map[string]bool)
	dir := e.cfg.Radio.SegmentDir
	seqRegex := regexp.MustCompile(`_(\d+)\.ts$`)

	log.Printf("📡 Uploader started. Monitoring: %s", dir)

	for range ticker.C {
		files, err := os.ReadDir(dir)
		if err != nil {
			log.Printf("❌ [Uploader] ReadDir error: %v", err)
			continue
		}

		for _, entry := range files {
			filename := entry.Name()
			fullPath := filepath.Join(dir, filename)
			info, err := entry.Info()
			if err != nil {
				continue
			}

			// Debounce: Wait 1s after file creation to ensure FFmpeg is done writing
			if time.Since(info.ModTime()) < 1*time.Second {
				continue
			}

			// A. Playlist Upload
			if filename == "stream.m3u8" {
				if info.ModTime().After(lastM3u8Time) {
					if err := e.uploadPlaylist(fullPath, filename); err == nil {
						log.Printf("📝 [Uploader] Master playlist updated")
						lastM3u8Time = info.ModTime()
					}
				}
				continue
			}

			// B. Segment Upload
			if strings.HasSuffix(filename, ".ts") && !uploadedSegments[filename] {
				// Update Persistence Sequence
				matches := seqRegex.FindStringSubmatch(filename)
				if len(matches) > 1 {
					if seq, err := strconv.Atoi(matches[1]); err == nil {
						e.state.IncrementSequence(seq)
					}
				}

				if err := e.uploadSegment(fullPath, filename); err != nil {
					log.Printf("❌ [Uploader] Segment %s upload failed: %v", filename, err)
				} else {
					log.Printf("⚡ [Uploader] Segment uploaded: %s", filename)
					uploadedSegments[filename] = true
					os.Remove(fullPath) // Delete local file after upload
				}
			}
		}

		// Housekeeping
		if len(uploadedSegments) > 100 {
			e.cleanupUploadedMap(uploadedSegments, dir)
		}
	}
}

func (e *Engine) uploadPlaylist(path, name string) error {
	timer := prometheus.NewTimer(uploadDuration.WithLabelValues("playlist"))
	defer timer.ObserveDuration()

	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()

	err = e.storage.UploadStreamFile(name, f, "application/vnd.apple.mpegurl", "max-age=0, no-cache, no-store, must-revalidate")
	if err == nil {
		uploadsTotal.WithLabelValues("playlist").Inc()
	}
	return err
}

func (e *Engine) uploadSegment(path, name string) error {
	timer := prometheus.NewTimer(uploadDuration.WithLabelValues("segment"))
	defer timer.ObserveDuration()

	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()

	err = e.storage.UploadStreamFile(name, f, "video/MP2T", "public, max-age=86400")
	if err == nil {
		uploadsTotal.WithLabelValues("segment").Inc()
	}
	return err
}

func (e *Engine) cleanupUploadedMap(m map[string]bool, dir string) {
	count := 0
	for k := range m {
		if _, err := os.Stat(filepath.Join(dir, k)); os.IsNotExist(err) {
			delete(m, k)
			count++
		}
	}
	if count > 0 {
		log.Printf("🧹 [Uploader] Cleaned %d entries from tracking map", count)
	}
}

func (e *Engine) startRedirectServer() {
	endpoint := strings.TrimRight(e.cfg.B2.Endpoint, "/")
	publicURL := fmt.Sprintf("%s/%s/stream.m3u8", endpoint, e.cfg.B2.BucketStream)
	port := ":8080"

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "Momo Radio Live.\nStream URL: %s", publicURL)
	})
	http.HandleFunc("/listen", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, publicURL, http.StatusFound)
	})
	http.Handle("/_metrics", promhttp.Handler())

	log.Printf("🌍 Helper Server listening at %s", port)
	http.ListenAndServe(port, nil)
}
