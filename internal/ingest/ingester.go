package ingest

import (
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/prometheus/client_golang/prometheus"

	"momo-radio/internal/audio"
	"momo-radio/internal/config"
	database "momo-radio/internal/db"
	"momo-radio/internal/metadata"
	"momo-radio/internal/models"
	"momo-radio/internal/organizer"
	"momo-radio/internal/storage"
	"momo-radio/internal/utils"
)

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

type Worker struct {
	cfg         *config.Config
	storage     *storage.Client
	db          *database.Client
	analysisSem chan struct{}
}

func New(cfg *config.Config, store *storage.Client, db *database.Client) *Worker {
	return &Worker{cfg: cfg, storage: store, db: db, analysisSem: make(chan struct{}, 2)}
}

func (w *Worker) Run() {
	ticker := time.NewTicker(time.Duration(w.cfg.Server.PollingInterval) * time.Second)
	defer ticker.Stop()

	log.Printf("Watcher started on '%s'...", w.cfg.B2.BucketIngest)
	w.processQueue()

	for range ticker.C {
		w.processQueue()
	}
}

func (w *Worker) processQueue() {
	keys, err := w.storage.ListIngestFiles()
	if err != nil {
		log.Printf("Error listing bucket: %v", err)
		return
	}

	if len(keys) > 0 {
		log.Printf("Found %d items in ingest queue.", len(keys))
	}

	for _, key := range keys {
		if strings.HasSuffix(key, "/") || !audio.IsSupportedFormat(key) {
			continue
		}

		log.Printf("Processing: %s", key)
		if err := w.processFile(key); err != nil {
			log.Printf("❌ FAILED %s: %v", key, err)
			jobs.WithLabelValues("failure").Inc()
		} else {
			log.Printf("✅ ORGANIZED %s", key)
			jobs.WithLabelValues("success").Inc()
		}
	}
}

func (w *Worker) processFile(key string) error {
	timer := prometheus.NewTimer(duration)
	defer timer.ObserveDuration()

	baseName := filepath.Base(key)
	ext := filepath.Ext(baseName)
	nameWithoutExt := strings.TrimSuffix(baseName, ext)

	rawPath := filepath.Join(w.cfg.Server.TempDir, "raw_"+baseName)
	cleanPath := filepath.Join(w.cfg.Server.TempDir, "clean_"+nameWithoutExt+".mp3")

	defer os.Remove(rawPath)
	defer os.Remove(cleanPath)

	// 1. Download & Validate
	obj, err := w.storage.DownloadIngestFile(key)
	if err != nil {
		return err
	}
	fRaw, _ := os.Create(rawPath)
	io.Copy(fRaw, obj.Body)
	obj.Body.Close()
	fRaw.Close()

	if err := audio.Validate(rawPath); err != nil {
		return w.storage.DeleteIngestFile(key)
	}

	// 2. Get Local Metadata (Internal Tags)
	meta, _ := metadata.GetLocal(rawPath)

	// 3. DEEP ACOUSTIC ANALYSIS (Essentia)
	log.Printf("   🎼 Performing Deep Acoustic Analysis on original %s...", ext)
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
		// Note: use the Discogs country if found, otherwise we could use analysis.Country
		log.Printf("   📊 Result: %.2f BPM | Key: %s %s", analysis.BPM, analysis.MusicalKey, analysis.Scale)
	}

	// Determine our "Best Knowledge" for searching
	searchArtist := meta.Artist
	searchTitle := meta.Title

	if searchArtist == "" || searchTitle == "" {
		log.Printf("   🔍 ID3 tags missing. Falling back to filename parsing...")
		cleanA, cleanT := utils.SanitizeFilename(baseName)
		if searchArtist == "" {
			searchArtist = cleanA
		}
		if searchTitle == "" {
			searchTitle = cleanT
		}
	}

	// 4. Querying Discogs (Enhanced Strategy)
	if w.cfg.Services.DiscogsToken != "" {
		log.Printf("   💿 Querying Discogs: [%s] - [%s]", searchArtist, searchTitle)

		// This now performs 2 calls: Search + Release Details
		enriched, err := metadata.EnrichViaDiscogs(searchArtist, searchTitle, w.cfg.Services.DiscogsToken)

		if err == nil {
			// Map ALL the new fields
			meta.Genre = enriched.Genre
			meta.Style = enriched.Style
			meta.Country = enriched.Country
			meta.CatalogNumber = enriched.CatalogNumber
			meta.Publisher = enriched.Publisher

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

			log.Printf("   ✨ Enriched: %s [%s] (%s) - Cat: %s", meta.Genre, meta.Style, meta.Country, meta.CatalogNumber)

			// MANDATORY RATE LIMIT: Sleep 2s because we made 2 requests
			time.Sleep(2 * time.Second)
		} else {
			log.Printf("   ⚠️ Discogs failed: %v", err)
		}
	} else {
		// ITUNES FALLBACK
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
			log.Printf("   ✨ iTunes Found: %s - %s", meta.Artist, meta.Title)
		}
	}

	meta.Year = utils.SanitizeYear(meta.Year)

	// Fallback cleanup
	if meta.Artist == "" {
		meta.Artist = "Unknown Artist"
	}
	if meta.Title == "" {
		meta.Title = nameWithoutExt
	}

	// 5. Normalize & Upload
	log.Printf("   -> Normalizing audio...")
	if err := audio.Normalize(rawPath, cleanPath); err != nil {
		log.Printf("❌ Normalization failed: %v", err)
		return err
	}

	destinationKey := organizer.BuildPath(meta, key)
	log.Printf("   -> Uploading to: %s", destinationKey)
	fClean, err := os.Open(cleanPath)
	if err != nil {
		return err
	}
	defer fClean.Close()

	if err := w.storage.UploadAssetFile(destinationKey, fClean, "audio/mpeg", "public, max-age=31536000"); err != nil {
		return err
	}

	// 6. DB Persistence
	track := models.Track{
		Key:           destinationKey,
		Title:         meta.Title,
		Artist:        meta.Artist,
		Album:         meta.Album,
		Genre:         meta.Genre, // Broad: "Electronic"
		Style:         meta.Style, // Specific: "Deep House, Minimal"
		Year:          meta.Year,
		Publisher:     meta.Publisher,
		CatalogNumber: meta.CatalogNumber,
		Country:       meta.Country,
		Format:        "mp3",
		BPM:           meta.BPM,
		Duration:      meta.Duration,
		MusicalKey:    meta.MusicalKey,
		Scale:         meta.Scale,
		Danceability:  meta.Danceability,
		Loudness:      meta.Loudness,
	}
	// Use FirstOrCreate to avoid duplicates, or Upsert logic
	w.db.DB.Where(models.Track{Key: destinationKey}).Assign(track).FirstOrCreate(&track)

	return w.storage.DeleteIngestFile(key)
}

// RepairMetadata updates existing records that are missing new fields
func (w *Worker) RepairMetadata() {
	log.Println("🛠️ Starting Metadata Repair process for Legacy Tracks...")

	var tracks []models.Track

	// 1. OPTIMIZATION: Only fetch tracks that are missing the new 'Country' or 'Style' data.
	// This prevents re-scanning thousands of tracks that are already perfect.
	err := w.db.DB.Where("country = '' OR country IS NULL OR style = '' OR style IS NULL").Find(&tracks).Error
	if err != nil {
		log.Printf("❌ Failed to fetch tracks: %v", err)
		return
	}

	count := len(tracks)
	log.Printf("🧐 Found %d legacy tracks needing metadata repair.", count)

	for i, track := range tracks {
		// Progress Logger
		if i > 0 && i%10 == 0 {
			log.Printf("⏳ Repair Progress: %d/%d tracks...", i, count)
		}

		searchArtist := track.Artist
		searchTitle := track.Title

		// 2. INTELLIGENT SEARCH: If DB has bad data, re-parse the original filename
		// This helps if the original ingest failed to read tags correctly.
		if searchArtist == "" || searchArtist == "Unknown Artist" || searchTitle == "" {
			log.Printf("   🔍 Bad DB metadata for [%s], re-parsing filename...", track.Key)
			cleanA, cleanT := utils.SanitizeFilename(filepath.Base(track.Key))
			searchArtist = cleanA
			searchTitle = cleanT
		}

		log.Printf("🔄 Processing: [%s] - [%s]", searchArtist, searchTitle)

		// 3. CALL DISCOGS (Uses the new 2-step logic: Search + Details)
		enriched, err := metadata.EnrichViaDiscogs(searchArtist, searchTitle, w.cfg.Services.DiscogsToken)

		if err != nil {
			log.Printf("   ⚠️ Discogs lookup failed for %s: %v", track.Key, err)
			// Sleep slightly less on failure, but still respect API limits
			time.Sleep(1 * time.Second)
			continue
		}

		// 4. PREPARE UPDATES
		updates := models.Track{
			Genre:         enriched.Genre,
			Style:         enriched.Style,         // The new specific sub-genres
			Country:       enriched.Country,       // The new Country data
			CatalogNumber: enriched.CatalogNumber, // The new CatNo
			Publisher:     enriched.Publisher,
			Year:          enriched.Year,
			Album:         enriched.Album,
		}

		// Optional: If Discogs gave us a better Artist/Title, take it.
		if enriched.Artist != "" {
			updates.Artist = enriched.Artist
		}
		if enriched.Title != "" {
			updates.Title = enriched.Title
		}

		// 5. SAVE TO DB
		err = w.db.DB.Model(&track).Updates(updates).Error

		if err != nil {
			log.Printf("   ❌ DB Update failed for ID %d: %v", track.ID, err)
		} else {
			log.Printf("   ✅ Repaired: %s | Style: %s | Country: %s", updates.Title, updates.Style, updates.Country)
		}

		// 6. RATE LIMIT (Crucial!)
		// sleep 2 seconds because 'EnrichViaDiscogs' makes 2 HTTP calls.
		// Discogs limit is 60 req/min. 2 calls * 2s wait = safe zone.
		time.Sleep(2 * time.Second)
	}

	log.Println("✨ Metadata Repair complete! All legacy tracks updated.")
}

// RepairAudio finds tracks with missing BPM/Key data and re-runs Essentia analysis.
func (w *Worker) RepairAudio() {
	log.Println("🛠️ Starting Audio Repair (Deep Analysis)...")

	var tracks []models.Track
	if err := w.db.DB.Where("bpm = 0 OR bpm IS NULL").Find(&tracks).Error; err != nil {
		log.Printf("❌ Failed to fetch tracks: %v", err)
		return
	}

	count := len(tracks)
	log.Printf("🧐 Found %d tracks missing acoustic data.", count)

	for i, track := range tracks {
		if i > 0 && i%5 == 0 {
			log.Printf("⏳ Audio Progress: %d/%d...", i, count)
		}

		log.Printf("   🎼 Analyzing: [%s]", track.Key)

		// 1. Download file from Production Bucket to Temp
		// We use your existing 'DownloadFile' method which targets 'bucketProd'
		tempPath := filepath.Join(w.cfg.Server.TempDir, "repair_audio_"+filepath.Base(track.Key))

		obj, err := w.storage.DownloadFile(track.Key)
		if err != nil {
			log.Printf("   ❌ Download failed: %v", err)
			continue
		}

		// Create the temp file
		f, err := os.Create(tempPath)
		if err != nil {
			log.Printf("   ❌ File creation failed: %v", err)
			obj.Body.Close()
			continue
		}

		// Stream the S3 body to the file
		_, copyErr := io.Copy(f, obj.Body)
		obj.Body.Close()
		f.Close()

		if copyErr != nil {
			log.Printf("   ❌ File write failed: %v", copyErr)
			os.Remove(tempPath)
			continue
		}

		// 2. Run Essentia
		// Acquire semaphore to prevent CPU overload
		w.analysisSem <- struct{}{}
		analysis, err := audio.AnalyzeDeep(tempPath)
		<-w.analysisSem // Release semaphore

		// Clean up immediately after analysis
		os.Remove(tempPath)

		if err != nil {
			log.Printf("   ⚠️ Essentia failed: %v", err)
			continue
		}

		// 3. Save only acoustic fields
		updates := map[string]interface{}{
			"bpm":          analysis.BPM,
			"musical_key":  analysis.MusicalKey,
			"scale":        analysis.Scale,
			"danceability": analysis.Danceability,
			"loudness":     analysis.Loudness,
			"duration":     analysis.Duration,
			"energy":       analysis.Energy,
		}

		if err := w.db.DB.Model(&track).Updates(updates).Error; err != nil {
			log.Printf("   ❌ DB Update failed: %v", err)
		} else {
			log.Printf("   ✅ Analyzed: %.2f BPM | Key: %s %s", analysis.BPM, analysis.MusicalKey, analysis.Scale)
		}
	}
	log.Println("✨ Audio Repair Complete!")
}
