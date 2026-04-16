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
	log.Println("Starting Metadata Repair process for Legacy Tracks...")

	var tracks []models.Track

	// 1. Fetch tracks with linked Artist/Album data
	// Note: We check if the linked Artist or Album is missing metadata
	err := w.db.DB.Preload("Artist").Preload("Album").
		Joins("JOIN artists ON artists.id = tracks.artist_id").
		Where("artists.artist_country = '' OR tracks.genre = '' OR tracks.style = ''").
		Find(&tracks).Error

	if err != nil {
		log.Printf("❌ Failed to fetch tracks: %v", err)
		return
	}

	count := len(tracks)
	log.Printf("🧐 Found %d legacy tracks needing metadata repair.", count)

	for i, track := range tracks {
		if i > 0 && i%10 == 0 {
			log.Printf("⏳ Repair Progress: %d/%d tracks...", i, count)
		}

		// Use related objects for searching
		searchArtist := track.Artist.Name
		searchTitle := track.Title

		if searchArtist == "" || searchArtist == "Unknown Artist" || searchTitle == "" {
			log.Printf("   🔍 Bad DB metadata for [%s], re-parsing filename...", track.Key)
			cleanA, cleanT := utils.SanitizeFilename(filepath.Base(track.Key))
			searchArtist = cleanA
			searchTitle = cleanT
		}

		enriched, err := metadata.EnrichViaDiscogs(searchArtist, searchTitle, w.cfg.Services.DiscogsToken, w.cfg.Services.ContactEmail)
		if err != nil {
			log.Printf("   ⚠️ Discogs lookup failed for %s: %v", track.Key, err)
			time.Sleep(1 * time.Second)
			continue
		}

		// 1. Update Artist
		if enriched.Artist != "" {
			w.db.DB.Model(&track.Artist).Updates(models.Artist{
				Name:          enriched.Artist,
				ArtistCountry: enriched.Country,
			})
		}

		// 2. Update Album (if linked)
		if track.AlbumID != nil && enriched.Album != "" {
			w.db.DB.Model(track.Album).Updates(models.Album{
				Title:          enriched.Album,
				Year:           enriched.Year,
				Publisher:      enriched.Publisher,
				CatalogNumber:  enriched.CatalogNumber,
				ReleaseCountry: enriched.Country,
			})
		}

		// 3. Update Track
		trackUpdates := models.Track{
			Title: enriched.Title,
			Genre: enriched.Genre,
			Style: enriched.Style,
		}
		w.db.DB.Model(&track).Updates(trackUpdates)

		log.Printf("   Repaired: %s | Artist: %s", enriched.Title, enriched.Artist)
		time.Sleep(2 * time.Second)
	}
	log.Println("✨ Metadata Repair complete!")
}

// RepairAudio finds tracks with missing BPM/Key data and re-runs Essentia analysis.
func (w *Worker) RepairAudio() {
	log.Println("🛠️ Starting Audio Repair (Deep Analysis)...")

	var tracks []models.Track
	if err := w.db.DB.Where("bpm = 0 OR bpm IS NULL").Find(&tracks).Error; err != nil {
		log.Printf("Failed to fetch tracks: %v", err)
		return
	}

	count := len(tracks)
	log.Printf("Found %d tracks missing acoustic data.", count)

	for i, track := range tracks {
		if i > 0 && i%5 == 0 {
			log.Printf("⏳ Audio Progress: %d/%d...", i, count)
		}

		tempPath := filepath.Join(w.cfg.Server.TempDir, "repair_audio_"+filepath.Base(track.Key))

		// Assume DownloadFile is part of your storage client
		obj, err := w.storage.DownloadFile(track.Key)
		if err != nil {
			log.Printf("   ❌ Download failed: %v", err)
			continue
		}

		f, err := os.Create(tempPath)
		if err != nil {
			log.Printf("   ❌ File creation failed: %v", err)
			obj.Body.Close()
			continue
		}

		_, copyErr := io.Copy(f, obj.Body)
		obj.Body.Close()
		f.Close()

		if copyErr != nil {
			os.Remove(tempPath)
			continue
		}

		w.analysisSem <- struct{}{}
		analysis, err := audio.AnalyzeDeep(tempPath)
		<-w.analysisSem
		os.Remove(tempPath)

		if err != nil {
			continue
		}

		// Save acoustic fields
		updates := map[string]interface{}{
			"bpm":          analysis.BPM,
			"musical_key":  analysis.MusicalKey,
			"scale":        analysis.Scale,
			"danceability": analysis.Danceability,
			"loudness":     analysis.Loudness,
			"duration":     analysis.Duration,
			"energy":       analysis.Energy,
		}

		w.db.DB.Model(&track).Updates(updates)
		log.Printf("   ✅ Analyzed: %.2f BPM", analysis.BPM)
	}
	log.Println("✨ Audio Repair Complete!")
}

// RepairCountry surgically updates ReleaseCountry and ArtistCountry.
func (w *Worker) RepairCountry(dryRun bool, targetArtists []string, provider string) {
	log.Printf("🌍 Starting targeted Country Repair (Provider: %s)...", provider)

	var tracks []models.Track
	query := w.db.DB.Preload("Artist").Preload("Album")

	if len(targetArtists) > 0 {
		query = query.Joins("JOIN artists ON artists.id = tracks.artist_id").Where("artists.name IN ?", targetArtists)
	} else {
		// Only tracks where the linked artist is missing a country
		query = query.Joins("JOIN artists ON artists.id = tracks.artist_id").Where("artists.artist_country = '' OR artists.artist_country IS NULL")
	}

	if err := query.Find(&tracks).Error; err != nil {
		log.Printf("❌ DB Error: %v", err)
		return
	}

	artistCache := make(map[string]string)

	for _, track := range tracks {
		artistName := track.Artist.Name
		if artistName == "" || artistName == "Unknown Artist" {
			continue
		}

		var resultStr string
		var found bool

		if resultStr, found = artistCache[artistName]; !found {
			log.Printf("🛰️  %s Search: %s", provider, artistName)

			var err error
			if provider == "discogs" {
				resultStr, err = metadata.GetArtistCountryViaDiscogs(artistName, w.cfg.Services.DiscogsToken)
				time.Sleep(2 * time.Second)
			} else {
				resultStr, err = metadata.GetArtistCountryViaMusicBrainz(artistName, w.cfg.Services.ContactEmail)
				time.Sleep(1 * time.Second)
			}

			if err != nil {
				artistCache[artistName] = ""
				continue
			}

			if len(resultStr) != 2 {
				geoCode, err := utils.GetCountryFromArea(resultStr)
				if err == nil {
					resultStr = geoCode
				}
				time.Sleep(1 * time.Second)
			}
			artistCache[artistName] = resultStr
		}

		if resultStr == "" {
			continue
		}

		if dryRun {
			log.Printf("🧪 [DRY RUN] Would update Artist %s to %s", artistName, resultStr)
		} else {
			// ⚡️ Update the linked Artist record
			w.db.DB.Model(&track.Artist).Update("ArtistCountry", resultStr)

			// ⚡️ If album exists and has no country, update it too
			if track.AlbumID != nil && track.Album.ReleaseCountry == "" {
				w.db.DB.Model(track.Album).Update("ReleaseCountry", resultStr)
			}
			log.Printf("   ✅ Updated Artist %s to %s", artistName, resultStr)
		}
	}
}
