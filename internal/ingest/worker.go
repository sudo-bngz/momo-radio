package ingest

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/hibiken/asynq"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"

	"momo-radio/internal/audio"
	"momo-radio/internal/config"
	database "momo-radio/internal/db"
	"momo-radio/internal/metadata"
	"momo-radio/internal/models"
	"momo-radio/internal/storage"
	"momo-radio/internal/utils"
)

// --- METRICS ---
var (
	jobs = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "radio_ingest_jobs_total",
			Help: "Total ingest jobs",
		},
		[]string{"status"},
	)
	duration = prometheus.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "radio_ingest_duration_seconds",
			Help:    "Processing time",
			Buckets: prometheus.DefBuckets,
		},
	)
)

func RegisterMetrics() {
	prometheus.MustRegister(jobs, duration)
}

// --- ASYNQ DEFINITIONS ---
const TypeTrackProcess = "track:process"

type TrackProcessPayload struct {
	TrackID uint   `json:"track_id"`
	FileKey string `json:"file_key"`
	IsRetry bool   `json:"is_retry"`
}

// --- WORKER ---
type Worker struct {
	cfg         *config.Config
	storage     *storage.Client
	db          *database.Client
	redis       *redis.Client
	analysisSem chan struct{}
}

func New(cfg *config.Config, store *storage.Client, db *database.Client, redisClient *redis.Client) *Worker {
	return &Worker{
		cfg:         cfg,
		storage:     store,
		db:          db,
		redis:       redisClient,
		analysisSem: make(chan struct{}, 2), // Limit concurrent heavy CPU tasks
	}
}

// HandleProcessTask executes the heavy processing pipeline
func (w *Worker) HandleProcessTask(ctx context.Context, t *asynq.Task) error {
	timer := prometheus.NewTimer(duration)
	defer timer.ObserveDuration()

	var payload TrackProcessPayload
	if err := json.Unmarshal(t.Payload(), &payload); err != nil {
		log.Printf("Task Failed: Failed to parse payload: %v", err)
		return fmt.Errorf("failed to parse payload: %v", err)
	}

	key := payload.FileKey
	trackIDStr := fmt.Sprintf("%d", payload.TrackID)
	log.Printf("Starting Job for Track ID %d: %s", payload.TrackID, key)

	// Updates DB and shouts to Frontend via Redis SSE
	updateStatus := func(status string, progress int) {
		w.db.DB.Model(&models.Track{}).Where("id = ?", payload.TrackID).Updates(map[string]interface{}{
			"processing_status":   status,
			"processing_progress": progress,
		})
		w.redis.Publish(ctx, "track_status:"+trackIDStr, status)
	}

	// 1. Setup Local Temp Files
	baseName := filepath.Base(key)
	ext := filepath.Ext(baseName)
	nameWithoutExt := strings.TrimSuffix(baseName, ext)

	rawPath := filepath.Join(w.cfg.Server.TempDir, "raw_"+baseName)
	cleanPath := filepath.Join(w.cfg.Server.TempDir, "clean_"+nameWithoutExt+".mp3")

	defer os.Remove(rawPath)
	defer os.Remove(cleanPath)

	var obj *storage.FileObject
	var downloadErr error

	if payload.IsRetry {
		updateStatus("downloading (retry)", 10)

		var track models.Track
		w.db.DB.First(&track, payload.TrackID)

		// Priority 1: Try Master Vault
		log.Printf("🔍 Retry requested. Looking for Master file: %s", track.MasterKey)
		obj, downloadErr = w.storage.DownloadMasterFile(track.MasterKey)

		// Priority 2: Fallback to Stream Asset
		if downloadErr != nil {
			log.Printf("Master missing! Falling back to stream asset: %s", track.Key)
			obj, downloadErr = w.storage.DownloadFile(track.Key)
		}
	} else {
		updateStatus("downloading (ingest)", 10)
		obj, downloadErr = w.storage.DownloadIngestFile(key)
	}

	// Handle Download Failure
	if downloadErr != nil {
		updateStatus("failed", 0)
		jobs.WithLabelValues("failure").Inc()
		log.Printf("Task Failed: Could not download audio file: %v", downloadErr)
		return downloadErr
	}

	// Write the downloaded file to the local disk for processing
	fRaw, _ := os.Create(rawPath)
	io.Copy(fRaw, obj.Body)
	obj.Body.Close()
	fRaw.Close()

	// ⚡️ 2. IMMEDIATELY SECURE THE MASTER FILE (Only on Fresh Uploads!)
	if !payload.IsRetry {
		updateStatus("archiving master", 15)
		fMaster, err := os.Open(rawPath)
		if err == nil {
			safeFilename := strings.ReplaceAll(baseName, " ", "_")
			masterKey := fmt.Sprintf("%d_%s", payload.TrackID, safeFilename)

			err = w.storage.UploadMasterFile(masterKey, fMaster, "audio/mpeg")
			fMaster.Close()

			if err != nil {
				log.Printf("Warning: Failed to secure Master File: %v", err)
			} else {
				log.Printf("Original file secured in Master Vault: %s", masterKey)
			}
		} else {
			log.Printf("Warning: Could not open local raw file for Master upload: %v", err)
		}
	}

	// 3. Audio Validation
	if err := audio.Validate(rawPath); err != nil {
		if !payload.IsRetry {
			w.storage.DeleteIngestFile(key) // Only clean dropzone if it was a fresh upload
		}
		updateStatus("failed", 0)
		jobs.WithLabelValues("failure").Inc()
		log.Printf("Task Failed: Audio validation failed for %s: %v", rawPath, err)
		return fmt.Errorf("invalid audio file format")
	}

	// 4. Local Metadata & Deep Acoustic Analysis
	updateStatus("analyzing", 30)
	meta, _ := metadata.GetLocal(rawPath)

	log.Printf("   🎼 Performing Deep Acoustic Analysis for %s...", baseName)
	w.analysisSem <- struct{}{}
	analysis, err := audio.AnalyzeDeep(rawPath)
	<-w.analysisSem

	if err == nil {
		meta.BPM = analysis.BPM
		meta.MusicalKey = analysis.MusicalKey
		meta.Scale = analysis.Scale
		meta.Danceability = analysis.Danceability
		meta.Loudness = analysis.Loudness
		meta.Duration = analysis.Duration
	}

	// 5. Metadata Enrichment (Discogs/iTunes)
	updateStatus("enriching", 60)

	searchArtist := meta.Artist
	searchTitle := meta.Title
	var artistOrigin string
	var discogsCoverURL string

	if searchArtist == "" || searchTitle == "" {
		cleanA, cleanT := utils.SanitizeFilename(baseName)
		if searchArtist == "" {
			searchArtist = cleanA
		}
		if searchTitle == "" {
			searchTitle = cleanT
		}
	}

	if w.cfg.Services.DiscogsToken != "" {
		enriched, err := metadata.EnrichViaDiscogs(searchArtist, searchTitle, w.cfg.Services.DiscogsToken, w.cfg.Services.ContactEmail)
		if err == nil {
			meta.Genre = enriched.Genre
			meta.Style = enriched.Style
			meta.Country = enriched.Country
			meta.CatalogNumber = enriched.CatalogNumber
			meta.Publisher = enriched.Publisher
			discogsCoverURL = enriched.CoverURL
			if meta.Year == "" {
				meta.Year = enriched.Year
			}
			if meta.Album == "" {
				meta.Album = enriched.Album
			}
			if meta.Artist == "" {
				meta.Artist = enriched.Artist
			}
			if meta.Title == "" {
				meta.Title = enriched.Title
			}

			time.Sleep(2 * time.Second)
			mbCountry, errAc := metadata.GetArtistCountryViaMusicBrainz(meta.Artist, w.cfg.Services.ContactEmail)
			if errAc == nil && mbCountry != "" {
				artistOrigin = utils.ResolveCountry(mbCountry)
			}
		}
	} else {
		itunesMeta, err := metadata.EnrichViaITunes(searchArtist + " " + searchTitle)
		if err == nil {
			if meta.Artist == "" {
				meta.Artist = itunesMeta.Artist
			}
			if meta.Title == "" {
				meta.Title = itunesMeta.Title
			}
			if meta.Album == "" {
				meta.Album = itunesMeta.Album
			}
			if meta.Genre == "" {
				meta.Genre = itunesMeta.Genre
			}
			if meta.Year == "" {
				meta.Year = itunesMeta.Year
			}
		}
	}

	meta.Year = utils.SanitizeYear(meta.Year)
	if meta.Artist == "" {
		meta.Artist = "Unknown Artist"
	}
	if meta.Title == "" {
		meta.Title = nameWithoutExt
	}
	if artistOrigin == "" {
		artistOrigin = "Unknown"
	}

	// 6. Normalize Audio
	updateStatus("normalizing", 80)
	if err := audio.Normalize(rawPath, cleanPath); err != nil {
		updateStatus("failed", 0)
		jobs.WithLabelValues("failure").Inc()
		log.Printf("Task Failed: Failed to normalize audio %s: %v", rawPath, err)
		return err
	}

	// 7. Upload Final Playable Audio to Asset Bucket
	updateStatus("uploading", 90)

	// Get the base path from your metadata logic
	baseDestinationKey := BuildPath(meta, key)
	finalExt := filepath.Ext(baseDestinationKey)
	pathWithoutExt := strings.TrimSuffix(baseDestinationKey, finalExt)
	destinationKey := fmt.Sprintf("%s_%d%s", pathWithoutExt, payload.TrackID, finalExt)

	fClean, err := os.Open(cleanPath)
	if err != nil {
		updateStatus("failed", 0)
		log.Printf("Task Failed: Failed to open cleaned audio file %s: %v", cleanPath, err)
		return err
	}
	defer fClean.Close()

	if err := w.storage.UploadAssetFile(destinationKey, fClean, "audio/mpeg", "public, max-age=31536000"); err != nil {
		updateStatus("failed", 0)
		jobs.WithLabelValues("failure").Inc()
		log.Printf("Task Failed: Failed to upload to asset bucket: %v", err)
		return err
	}

	// 8. Database Relations
	var artist models.Artist
	w.db.DB.Where(models.Artist{Name: meta.Artist}).FirstOrCreate(&artist)
	if artist.ArtistCountry == "" && artistOrigin != "Unknown" {
		w.db.DB.Model(&artist).Update("ArtistCountry", artistOrigin)
	}

	var album models.Album
	var albumID *uint
	if meta.Album != "" {
		err := w.db.DB.Where(models.Album{Title: meta.Album, ArtistID: artist.ID}).First(&album).Error

		if err == gorm.ErrRecordNotFound || err != nil {
			album = models.Album{
				Title:          meta.Album,
				ArtistID:       artist.ID,
				Year:           meta.Year,
				Publisher:      meta.Publisher,
				CatalogNumber:  meta.CatalogNumber,
				ReleaseCountry: utils.ResolveCountry(meta.Country),
			}
			w.db.DB.Create(&album)
		} else {
			albumUpdates := map[string]any{}

			if album.Year == "" && meta.Year != "" {
				albumUpdates["year"] = meta.Year
			}
			if album.Publisher == "" && meta.Publisher != "" {
				albumUpdates["publisher"] = meta.Publisher
			}
			if album.CatalogNumber == "" && meta.CatalogNumber != "" {
				albumUpdates["catalog_number"] = meta.CatalogNumber
			}
			if album.ReleaseCountry == "" && meta.Country != "" {
				albumUpdates["release_country"] = utils.ResolveCountry(meta.Country)
			}

			if len(albumUpdates) > 0 {
				w.db.DB.Model(&album).Updates(albumUpdates)
			}
		}
		albumID = &album.ID
	}

	// 9. Cover Art Pipeline
	if albumID != nil && album.CoverKey == "" {
		var rawImage []byte
		var errImg error

		if len(meta.AttachedPicture) > 0 {
			rawImage = meta.AttachedPicture
		} else if discogsCoverURL != "" {
			rawImage, errImg = metadata.DownloadImage(discogsCoverURL, w.cfg.Services.DiscogsToken)
		}

		if len(rawImage) > 0 && errImg == nil {
			processedImg, errProc := metadata.ProcessCover(rawImage)
			if errProc == nil {
				coverKey := fmt.Sprintf("covers/album_%d.jpg", album.ID)
				errUpload := w.storage.UploadAssetFile(coverKey, bytes.NewReader(processedImg), "image/jpeg", "public, max-age=31536000")
				if errUpload == nil {
					w.db.DB.Model(&album).Update("CoverKey", coverKey)
				}
			}
		}
	}

	// 10. Finalize Track record
	w.db.DB.Model(&models.Track{}).Where("id = ?", payload.TrackID).Updates(map[string]interface{}{
		"key":                 destinationKey, // Points to the public playable asset
		"title":               meta.Title,
		"artist_id":           artist.ID,
		"album_id":            albumID,
		"genre":               meta.Genre,
		"style":               meta.Style,
		"format":              "mp3",
		"bpm":                 meta.BPM,
		"duration":            meta.Duration,
		"musical_key":         meta.MusicalKey,
		"scale":               meta.Scale,
		"danceability":        meta.Danceability,
		"loudness":            meta.Loudness,
		"file_size":           int(obj.ContentLength),
		"processing_status":   "completed",
		"processing_progress": 100,
	})

	if !payload.IsRetry {
		log.Printf("🧹 Sweeping dropzone: deleting %s", key)
		w.storage.DeleteIngestFile(key)
		w.cleanupFolders([]string{key})
	}

	// Signal the frontend to close the stream
	w.redis.Publish(ctx, "track_status:"+trackIDStr, "completed")
	jobs.WithLabelValues("success").Inc()
	log.Printf("Job Completed: Track ID %d", payload.TrackID)

	return nil
}

// cleanupFolders removes empty directories in the ingest bucket
func (w *Worker) cleanupFolders(allKeys []string) {
	var dirs []string
	for _, k := range allKeys {
		dir := filepath.Dir(k)
		if dir != "." && dir != "/" {
			dirs = append(dirs, dir+"/")
		}
	}

	sort.Slice(dirs, func(i, j int) bool {
		return len(dirs[i]) > len(dirs[j])
	})

	for _, dir := range dirs {
		isEmpty, err := w.storage.IsPrefixEmpty(dir)
		if err == nil && isEmpty {
			log.Printf("Removing empty folder: %s", dir)
			_ = w.storage.DeleteIngestFile(dir)
		}
	}
}
