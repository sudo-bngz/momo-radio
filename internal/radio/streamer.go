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
	"strings"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"

	"momo-radio/internal/audio"
	"momo-radio/internal/config"
	database "momo-radio/internal/db"
	"momo-radio/internal/dj"
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
	}
}

func (e *Engine) Run() {
	log.Printf("🆔 Engine Run ID: %d", e.runID)

	// Prepare output dir
	os.RemoveAll(e.cfg.Radio.SegmentDir)
	os.MkdirAll(e.cfg.Radio.SegmentDir, 0755)

	// Decks
	musicDeck := dj.NewDeck(e.storage, e.db, "music/")
	jingleDeck := dj.NewDeck(e.storage, e.db, "station_id/")

	// Pipeline
	pr, pw := io.Pipe()

	// 1. FFmpeg Consumer
	go audio.StartStreamProcess(pr, e.cfg, e.runID)

	// 2. DJ Producer
	go e.runScheduler(pw, musicDeck, jingleDeck)

	// 3. Web Helper
	go e.startRedirectServer()

	// 4. Uploader (Blocking)
	e.startStreamUploader()
}

func (e *Engine) runScheduler(output *io.PipeWriter, musicDeck, jingleDeck *dj.Deck) {
	defer output.Close()
	songsSinceJingle := 0

	// Use configured prefetch count or default to 5
	prefetchCount := e.cfg.Radio.PrefetchCount
	if prefetchCount <= 0 {
		prefetchCount = 5
	}

	for {
		var track string

		if songsSinceJingle >= 3 {
			log.Println("\n>>> 🔔 Jingle Time")
			track = jingleDeck.NextTrack()
			if track != "" {
				songsSinceJingle = 0
			}
		}

		if track == "" {
			log.Println("\n>>> 🎵 Music Time")
			track = musicDeck.NextTrack()
			songsSinceJingle++
		}

		if track == "" {
			log.Println("❌ Library empty. Retrying in 10s...")
			time.Sleep(10 * time.Second)
			continue
		}

		// --- PREFETCH STRATEGY ---
		// Build list of keys to keep/fetch
		keys := []string{track}

		// Peek next music tracks
		if nexts := musicDeck.Peek(prefetchCount); len(nexts) > 0 {
			keys = append(keys, nexts...)
		}

		// Trigger background download
		e.cache.Prefetch(keys)

		// Cleanup old stuff (pass keys we want to keep)
		go e.cache.Cleanup(keys)

		log.Printf("▶️  Playing: %s", track)
		tracksPlayed.Inc()
		go e.updateNowPlaying(track)

		if err := e.streamFileToPipe(track, output); err != nil {
			log.Printf("❌ Stream error: %v (Skipping)", err)
			continue
		}
	}
}

func (e *Engine) streamFileToPipe(key string, pipe *io.PipeWriter) error {
	// 1. Get local path (Downloads if not exists, but normally prefetched)
	localPath, err := e.cache.GetLocalPath(key)
	if err != nil {
		return err
	}

	// 2. Open local file
	f, err := os.Open(localPath)
	if err != nil {
		return err
	}
	defer f.Close()

	// 3. Copy from Disk to Pipe (Fast & Stable)
	// Even if this blocks, it blocks on Disk I/O, not Network.
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
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()
	var lastM3u8Time time.Time
	dir := e.cfg.Radio.SegmentDir

	for range ticker.C {
		files, err := os.ReadDir(dir)
		if err != nil {
			log.Printf("ReadDir error: %v", err)
			continue
		}

		for _, entry := range files {
			filename := entry.Name()
			fullPath := filepath.Join(dir, filename)

			if filename == "stream.m3u8" {
				info, err := entry.Info()
				if err != nil {
					continue
				}
				if info.ModTime().After(lastM3u8Time) {
					timer := prometheus.NewTimer(uploadDuration.WithLabelValues("playlist"))
					f, _ := os.Open(fullPath)
					err := e.storage.UploadStreamFile(filename, f, "application/vnd.apple.mpegurl", "max-age=0, no-cache, no-store, must-revalidate")
					f.Close()
					timer.ObserveDuration()
					if err == nil {
						lastM3u8Time = info.ModTime()
						uploadsTotal.WithLabelValues("playlist").Inc()
						log.Printf("📝 Playlist updated")
					}
				}
				continue
			}

			if strings.HasSuffix(filename, ".ts") {
				log.Printf("⚡ Segment: %s", filename)
				timer := prometheus.NewTimer(uploadDuration.WithLabelValues("segment"))
				f, _ := os.Open(fullPath)
				err := e.storage.UploadStreamFile(filename, f, "video/MP2T", "public, max-age=86400")
				f.Close()
				timer.ObserveDuration()
				if err == nil {
					uploadsTotal.WithLabelValues("segment").Inc()
					os.Remove(fullPath)
				}
			}
		}
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
