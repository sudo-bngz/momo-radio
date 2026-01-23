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
	"momo-radio/internal/dj"
	"momo-radio/internal/models"
	"momo-radio/internal/storage"
)

// Metrics
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

type Engine struct {
	cfg     *config.Config
	storage *storage.Client
	db      *database.Client
	runID   int64
	cache   *CacheManager
	state   *StateManager // Persistence Manager
}

type CurrentTrack struct {
	Artist    string `json:"artist"`
	Title     string `json:"title"`
	Album     string `json:"album"`
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
		cfg:     cfg,
		storage: store,
		db:      db,
		runID:   time.Now().Unix(),
		cache:   NewCacheManager(adapter, cfg.Server.TempDir),
		state:   NewStateManager(db.DB), // Init Persistence
	}
}

func (e *Engine) Run() {
	log.Printf("🆔 Engine Run ID: %d", e.runID)

	// Prepare output dir
	os.RemoveAll(e.cfg.Radio.SegmentDir)
	os.MkdirAll(e.cfg.Radio.SegmentDir, 0755)

	// --- RESUME LOGIC ---
	// Check DB for previous state
	state, err := e.state.GetCurrentState()

	// Default: Start fresh
	startSequence := 0
	var resumeTrackID uint

	// If state exists and is recent (< 10 mins), try to resume
	if err == nil && time.Since(state.UpdatedAt) < 10*time.Minute {
		log.Printf("🔄 RECOVERED STATE: Resuming HLS sequence at %d", state.Sequence)
		// increment by a safe margin (e.g., +2) to ensure no overlap with old segments
		startSequence = state.Sequence + 2
		resumeTrackID = state.TrackID
	} else {
		log.Println("🆕 Starting Fresh Stream Sequence")
	}
	// --------------------

	// Decks
	musicDeck := dj.NewDeck(e.storage, e.db, "music/")
	jingleDeck := dj.NewDeck(e.storage, e.db, "station_id/")

	// Pipeline
	pr, pw := io.Pipe()

	// 1. FFmpeg Consumer
	// Note: update audio.StartStreamProcess to accept 'startSequence'
	// e.g., using "-start_number" flag in FFmpeg
	go audio.StartStreamProcess(pr, e.cfg, e.runID, int64(startSequence))

	// 2. DJ Producer
	go e.runScheduler(pw, musicDeck, jingleDeck, resumeTrackID)

	// 3. Web Helper
	go e.startRedirectServer()

	// 4. Uploader (Blocking)
	e.startStreamUploader()
}

func (e *Engine) runScheduler(output *io.PipeWriter, musicDeck, jingleDeck *dj.Deck, resumeID uint) {
	defer output.Close()
	songsSinceJingle := 0

	prefetchCount := e.cfg.Radio.PrefetchCount
	if prefetchCount <= 0 {
		prefetchCount = 5
	}

	firstRun := true

	for {
		var trackKey string

		// --- RESUME TRACK LOGIC ---
		if firstRun && resumeID != 0 {
			var t models.Track
			if err := e.db.DB.First(&t, resumeID).Error; err == nil {
				log.Printf("🔙 Resuming Previous Track: %s", t.Title)
				trackKey = t.Key
			}
			firstRun = false
		}
		// --------------------------

		// Normal Scheduler Logic
		if trackKey == "" {
			if songsSinceJingle >= 3 {
				log.Println("\n>>> 🔔 Jingle Time")
				trackKey = jingleDeck.NextTrack()
				if trackKey != "" {
					songsSinceJingle = 0
				}
			}

			if trackKey == "" {
				log.Println("\n>>> 🎵 Music Time")
				trackKey = musicDeck.NextTrack()
				songsSinceJingle++
			}
		}

		if trackKey == "" {
			log.Println("❌ Library empty. Retrying in 10s...")
			time.Sleep(10 * time.Second)
			continue
		}

		// Update State Persistence (We started a new track)
		// We need the ID for the state table.
		var currentTrackModel models.Track
		if err := e.db.DB.Select("id").Where("key = ?", trackKey).First(&currentTrackModel).Error; err == nil {
			// Note: We pass 0 for sequence here, as it's updated separately by the uploader
			e.state.UpdateTrack(currentTrackModel.ID, 0)
		}

		// Prefetch
		keys := []string{trackKey}
		if nexts := musicDeck.Peek(prefetchCount); len(nexts) > 0 {
			keys = append(keys, nexts...)
		}
		e.cache.Prefetch(keys)
		go e.cache.Cleanup(keys)

		log.Printf("▶️  Playing: %s", trackKey)
		tracksPlayed.Inc()
		go e.updateNowPlaying(trackKey)
		go e.recordTrackPlay(trackKey)

		if err := e.streamFileToPipe(trackKey, output); err != nil {
			log.Printf("❌ Stream error: %v (Skipping)", err)
			continue
		}
	}
}

func (e *Engine) recordTrackPlay(key string) {
	now := time.Now()

	var track models.Track
	err := e.db.DB.Model(&track).
		Where("key = ?", key).
		Updates(map[string]any{
			"play_count":  gorm.Expr("play_count + 1"),
			"last_played": now,
		}).First(&track).Error

	if err != nil {
		log.Printf("⚠️  DB Error updating track stats for %s: %v", key, err)
		return
	}

	history := models.PlayHistory{
		TrackID:  track.ID,
		PlayedAt: now,
	}

	if err := e.db.DB.Create(&history).Error; err != nil {
		log.Printf("⚠️  DB Error creating play history for ID %d: %v", track.ID, err)
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

func (e *Engine) updateNowPlaying(key string) {
	parts := strings.Split(key, "/")
	filename := parts[len(parts)-1]
	cleanName := strings.TrimSuffix(filename, filepath.Ext(filename))

	track := CurrentTrack{
		Title:     strings.ReplaceAll(cleanName, "_", " "),
		Artist:    "Unknown",
		StartedAt: time.Now().Unix(),
	}

	nameParts := strings.SplitN(cleanName, "-", 2)
	if len(nameParts) == 2 {
		track.Artist = strings.ReplaceAll(nameParts[0], "_", " ")
		track.Title = strings.ReplaceAll(nameParts[1], "_", " ")
	}

	if len(parts) >= 2 {
		track.Album = strings.ReplaceAll(parts[len(parts)-2], "_", " ")
	}

	data, _ := json.Marshal(track)
	e.storage.UploadStreamFile("now_playing.json",
		bytes.NewReader(data),
		"application/json",
		"max-age=0, no-cache")
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

			if time.Since(info.ModTime()) < 1*time.Second {
				continue
			}

			if filename == "stream.m3u8" {
				if info.ModTime().After(lastM3u8Time) {
					if err := e.uploadPlaylist(fullPath, filename); err == nil {
						log.Printf("📝 [Uploader] Master playlist updated")
						lastM3u8Time = info.ModTime()
					}
				}
				continue
			}

			// ⚡ Segment Upload
			if strings.HasSuffix(filename, ".ts") && !uploadedSegments[filename] {
				// Persistence logic
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
					os.Remove(fullPath)
				}
			}
		}

		// 🧹 Map Housekeeping
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
	// ⏱️ Start Timer
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
		fmt.Fprintf(w, "Radio Live. Stream: %s", publicURL)
	})
	http.HandleFunc("/listen", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, publicURL, http.StatusFound)
	})
	http.Handle("/_metrics", promhttp.Handler())

	log.Printf("🌍 Helper at %s", port)
	http.ListenAndServe(port, nil)
}
