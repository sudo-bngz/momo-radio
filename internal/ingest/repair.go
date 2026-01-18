package ingest

import (
	"io"
	"log"
	"momo-radio/internal/audio"
	"momo-radio/internal/metadata"
	"momo-radio/internal/models"
	"momo-radio/internal/utils"
	"os"
	"path/filepath"
	"time"
)

// RepairMetadata updates existing records that are missing new fields
func (w *Worker) RepairMetadata() {
	log.Println("🛠️ Starting Metadata Repair process for Legacy Tracks...")

	var tracks []models.Track

	// 1. OPTIMIZATION: Only fetch tracks that are missing the new 'Country' or 'Style' data.
	// This prevents re-scanning thousands of tracks that are already perfect.
	err := w.db.DB.Where("artist_country = '' OR country IS NULL OR style = '' OR style IS NULL").Find(&tracks).Error
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
		enriched, err := metadata.EnrichViaDiscogs(searchArtist, searchTitle, w.cfg.Services.DiscogsToken, w.cfg.Services.ContactEmail)

		if err != nil {
			log.Printf("   ⚠️ Discogs lookup failed for %s: %v", track.Key, err)
			// Sleep slightly less on failure, but still respect API limits
			time.Sleep(1 * time.Second)
			continue
		}

		// 4. PREPARE UPDATES
		updates := models.Track{
			Genre:          enriched.Genre,
			Style:          enriched.Style,
			ReleaseCountry: enriched.Country,
			ArtistCountry:  enriched.Country,
			CatalogNumber:  enriched.CatalogNumber,
			Publisher:      enriched.Publisher,
			Year:           enriched.Year,
			Album:          enriched.Album,
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
			log.Printf("   ✅ Repaired: %s | Style: %s | Country: %s", updates.Title, updates.Style, updates.ArtistCountry)
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

// RepairCountry surgically updates ReleaseCountry and ArtistCountry.
func (w *Worker) RepairCountry(dryRun bool, targetArtists []string, provider string) {
	log.Printf("🌍 Starting targeted Country Repair (Provider: %s)...", provider)

	var tracks []models.Track
	query := w.db.DB

	if len(targetArtists) > 0 {
		query = query.Where("artist IN ?", targetArtists)
	} else {
		// Fix tracks missing either piece of regional data
		query = query.Where("release_country = '' OR artist_country = '' OR artist_country IS NULL OR release_country IS NULL")
	}

	if err := query.Find(&tracks).Error; err != nil {
		log.Printf("❌ DB Error: %v", err)
		return
	}

	// Cache to save API calls (Artist-based)
	artistCache := make(map[string]string)

	for _, track := range tracks {
		if track.Artist == "" || track.Artist == "Unknown Artist" {
			continue
		}

		var countryCode string
		var found bool

		if countryCode, found = artistCache[track.Artist]; !found {
			log.Printf("🛰️  %s Search: %s", provider, track.Artist)

			var err error
			if provider == "discogs" {
				countryCode, err = metadata.GetArtistCountryViaDiscogs(track.Artist, w.cfg.Services.DiscogsToken)
				time.Sleep(2 * time.Second)
			} else {
				countryCode, err = metadata.GetArtistCountryViaMusicBrainz(track.Artist, w.cfg.Services.ContactEmail)
				time.Sleep(1 * time.Second)
			}

			if err != nil {
				log.Printf("   ⚠️ %s error for %s: %v", provider, track.Artist, err)
				artistCache[track.Artist] = ""
				continue
			}
			artistCache[track.Artist] = countryCode
		}

		if countryCode == "" {
			continue
		}

		// Prepare updates for the new fields
		updates := make(map[string]interface{})

		// 1. Logic for ArtistCountry (Always trust the Artist search for this)
		if track.ArtistCountry != countryCode {
			updates["artist_country"] = countryCode
		}

		// 2. Logic for ReleaseCountry (If missing, we use the Artist's country as a fallback)
		if track.ReleaseCountry == "" {
			updates["release_country"] = countryCode
		}

		if len(updates) > 0 {
			if dryRun {
				log.Printf("🧪 [DRY RUN] Would update %s (%s): %v", track.Artist, track.Title, updates)
			} else {
				err := w.db.DB.Model(&track).Updates(updates).Error
				if err != nil {
					log.Printf("   ❌ Update failed: %v", err)
				} else {
					log.Printf("   ✅ Updated %s: %v", track.Artist, updates)
				}
			}
		}
	}
}
