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
	"momo-radio/internal/storage"

	"momo-radio/internal/dj"
	"momo-radio/internal/dj/mix"
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
	cfg      *config.Config
	storage  *storage.Client
	db       *database.Client
	runID    int64
	cache    *CacheManager
	state    *StateManager
	musicDJ  dj.Provider
	jingleDJ dj.Provider
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
		cfg:     cfg,
		storage: store,
		db:      db,
		runID:   time.Now().Unix(),
		cache:   NewCacheManager(adapter, cfg.Server.TempDir),
		state:   NewStateManager(db.DB),
	}
}

// ... imports

func (e *Engine) Run() {
	log.Printf("🆔 Engine Run ID: %d", e.runID)
	log.Printf("🎛️ Active Provider: %s", e.cfg.Radio.Provider) // Log the choice

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
	} else {
		log.Println("🆕 Starting Fresh Stream Sequence")
	}

	// 3. Initialize Music Deck based on Config
	var musicDeck dj.Provider

	switch strings.ToLower(e.cfg.Radio.Provider) {
	case "harmonic":
		musicDeck = mix.NewDeck(e.storage, e.db, "music/")
	case "starvation":
		// The smart random deck (uses DB only)
		musicDeck = mix.NewStarvationProvider(e.db.DB, "music/")
	case "timetable":
		// Wraps starvation but strictly enforces time slots (if you implemented the wrapper)
		// For now, let's just default to Starvation as the base
		base := mix.NewStarvationProvider(e.db.DB, "music/")
		// If you had a Timetable wrapper: musicDeck = mix.NewTimetableWrapper(base)
		musicDeck = base
	default:
		log.Printf("⚠️ Unknown provider '%s'. Defaulting to Starvation.", e.cfg.Radio.Provider)
		musicDeck = mix.NewStarvationProvider(e.db.DB, "music/")
	}

	// Initialize Jingle Deck (Always simple starvation is usually best for jingles)
	jingleDeck := mix.NewStarvationProvider(e.db.DB, "station_id/")

	// Assign to Engine
	e.musicDJ = musicDeck
	e.jingleDJ = jingleDeck

	// 4. Setup Pipeline
	pr, pw := io.Pipe()

	// A. FFmpeg Consumer
	go audio.StartStreamProcess(pr, e.cfg, e.runID, int64(startSequence))

	// B. DJ Producer
	go e.runScheduler(pw, musicDeck, jingleDeck, resumeTrackID)

	// C. Helper Server
	go e.startRedirectServer()

	// D. Uploader
	e.startStreamUploader()
}

// runScheduler is the main loop that picks songs
func (e *Engine) runScheduler(output *io.PipeWriter, musicDeck, jingleDeck dj.Provider, resumeID uint) {
	defer output.Close()
	songsSinceJingle := 0

	prefetchCount := e.cfg.Radio.PrefetchCount
	if prefetchCount <= 0 {
		prefetchCount = 5
	}

	firstRun := true

	for {
		var selectedTrack *dj.Track
		var err error

		// --- RESUME OLD TRACK ---
		if firstRun && resumeID != 0 {
			var t models.Track
			if dbErr := e.db.DB.First(&t, resumeID).Error; dbErr == nil {
				log.Printf("🔙 Resuming Previous Track: %s", t.Title)
				// Manually construct the dj.Track since we bypassed the provider
				selectedTrack = &dj.Track{
					ID:     t.ID,
					Key:    t.Key,
					Artist: t.Artist,
					Title:  t.Title,
				}
			}
			firstRun = false
		}

		// --- SELECTION LOGIC ---
		if selectedTrack == nil {
			// Jingle Logic (Every 3 songs)
			if songsSinceJingle >= 3 {
				log.Println("\n>>> 🔔 Jingle Time")
				selectedTrack, err = jingleDeck.GetNextTrack()
				if err == nil {
					songsSinceJingle = 0
				} else {
					log.Printf("⚠️ Jingle deck skipped: %v", err)
				}
			}

			// Music Logic
			if selectedTrack == nil {
				// This triggers the Scheduler + Harmonic Mixing internally
				selectedTrack, err = musicDeck.GetNextTrack()
				if err == nil {
					songsSinceJingle++
					log.Printf("\n>>> 🎵 Music Time (%s)", musicDeck.Name())
				} else {
					log.Printf("❌ Music deck error: %v", err)
				}
			}
		}

		// Safety Net
		if selectedTrack == nil {
			log.Println("❌ No track selected. Retrying in 10s...")
			time.Sleep(10 * time.Second)
			continue
		}

		// --- PLAYOUT ---

		// 1. Update Persistence (DB State)
		e.state.UpdateTrack(selectedTrack.ID, 0)

		// 2. Prefetch Next Tracks (Lookahead)
		// We can't officially 'Peek' on the generic interface,
		// but since we know it's a *mix.Deck, we could assert it if we really needed peeking.
		// For now, we just prefetch the current track to ensure it's ready.
		e.cache.Prefetch([]string{selectedTrack.Key})
		go e.cache.Cleanup([]string{selectedTrack.Key})

		// 3. Stats & Metadata
		log.Printf("▶️  Playing: %s - %s", selectedTrack.Artist, selectedTrack.Title)
		tracksPlayed.Inc()

		// We pass the full track object now to updateNowPlaying, to be more accurate
		go e.updateNowPlaying(selectedTrack, musicDeck.Name())
		go e.recordTrackPlay(selectedTrack)

		// 4. Stream Audio
		if err := e.streamFileToPipe(selectedTrack.Key, output); err != nil {
			log.Printf("❌ Stream error: %v (Skipping)", err)
			continue
		}
	}
}

func (e *Engine) recordTrackPlay(t *dj.Track) {
	now := time.Now()

	// We update the DB model based on the ID we got from the DJ
	err := e.db.DB.Model(&models.Track{}).
		Where("id = ?", t.ID).
		Updates(map[string]any{
			"play_count":  gorm.Expr("play_count + 1"),
			"last_played": now,
		}).Error

	if err != nil {
		log.Printf("⚠️  DB Error updating track stats: %v", err)
		return
	}

	// Insert History Record
	history := models.PlayHistory{
		TrackID:  t.ID,
		PlayedAt: now,
	}
	if err := e.db.DB.Create(&history).Error; err != nil {
		log.Printf("⚠️  DB Error creating play history: %v", err)
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

func (e *Engine) updateNowPlaying(t *dj.Track, deckName string) {
	// If deckName contains the show name "Harmonic Deck (Morning Jazz)", extract it
	showName := "General Rotation"
	if strings.Contains(deckName, "(") {
		start := strings.Index(deckName, "(")
		end := strings.Index(deckName, ")")
		if start != -1 && end != -1 {
			showName = deckName[start+1 : end]
		}
	}

	trackData := CurrentTrack{
		Title:     t.Title,
		Artist:    t.Artist,
		Show:      showName,
		StartedAt: time.Now().Unix(),
	}

	// Fallback if metadata is missing (e.g. filename parse)
	if trackData.Title == "" {
		parts := strings.Split(t.Key, "/")
		filename := parts[len(parts)-1]
		trackData.Title = strings.TrimSuffix(filename, filepath.Ext(filename))
		trackData.Artist = "Unknown"
	}

	// Heuristic for Album (Folder name)
	parts := strings.Split(t.Key, "/")
	if len(parts) >= 2 {
		trackData.Album = strings.ReplaceAll(parts[len(parts)-2], "_", " ")
	}

	// Upload to B2
	data, _ := json.Marshal(trackData)
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
