package ingest

import (
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"momo-radio/internal/audio"
	"momo-radio/internal/metadata"
	"momo-radio/internal/models"
	"momo-radio/internal/utils"
)

// RepairMetadata updates existing records that are missing new fields
func (w *Worker) RepairMetadata() {
	log.Println("Starting Metadata Repair process for Legacy Tracks...")

	var tracks []models.Track

	// 1. Fetch tracks using the new Many-to-Many Join
	err := w.db.DB.Preload("Artists").Preload("Album").
		Joins("LEFT JOIN track_artists ON track_artists.track_id = tracks.id").
		Joins("LEFT JOIN artists ON artists.id = track_artists.artist_id").
		Where("artists.artist_country = '' OR tracks.genre = '' OR tracks.style = ''").
		Group("tracks.id").
		Find(&tracks).Error

	if err != nil {
		log.Printf("Failed to fetch tracks: %v", err)
		return
	}

	count := len(tracks)
	log.Printf("Found %d legacy tracks needing metadata repair.", count)

	for i, track := range tracks {
		if i > 0 && i%10 == 0 {
			log.Printf("⏳ Repair Progress: %d/%d tracks...", i, count)
		}

		// Combine all artist names for the search query
		var artistNames []string
		for _, a := range track.Artists {
			artistNames = append(artistNames, a.Name)
		}
		searchArtist := strings.Join(artistNames, " ")
		searchTitle := track.Title

		if searchArtist == "" || searchTitle == "" {
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

		// 1. Update Artists (Clear old, insert new)
		if len(enriched.Artists) > 0 {
			w.db.DB.Model(&track).Association("Artists").Clear()
			for _, name := range enriched.Artists {
				var artist models.Artist
				w.db.DB.Where(models.Artist{Name: name, OrganizationID: track.OrganizationID}).
					FirstOrCreate(&artist, models.Artist{Name: name, OrganizationID: track.OrganizationID})

				// Update country if we found a new one
				if artist.ArtistCountry == "" && enriched.Country != "" {
					w.db.DB.Model(&artist).Update("ArtistCountry", enriched.Country)
				}
				track.Artists = append(track.Artists, artist)
			}
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

		log.Printf("   Repaired: %s | Artists: %s", enriched.Title, strings.Join(enriched.Artists, ", "))
		time.Sleep(2 * time.Second)
	}
	log.Println("✨ Metadata Repair complete!")
}

// RepairAudio finds tracks with missing BPM/Key data and re-runs Essentia analysis.
// (No changes needed for the Many-to-Many update)
func (w *Worker) RepairAudio() {
	log.Println("Starting Audio Repair (Deep Analysis)...")

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

		obj, err := w.storage.DownloadFile(track.Key)
		if err != nil {
			continue
		}

		f, err := os.Create(tempPath)
		if err != nil {
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
		log.Printf("Analyzed: %.2f BPM", analysis.BPM)
	}
	log.Println("✨ Audio Repair Complete!")
}

// RepairCountry surgically updates ReleaseCountry and ArtistCountry.
// ⚡️ OPTIMIZED: Now queries the Artists table directly!
func (w *Worker) RepairCountry(dryRun bool, targetArtists []string, provider string) {
	log.Printf("Starting targeted Country Repair (Provider: %s)...", provider)

	var artists []models.Artist
	query := w.db.DB.Model(&models.Artist{})

	if len(targetArtists) > 0 {
		query = query.Where("name IN ?", targetArtists)
	} else {
		query = query.Where("artist_country = '' OR artist_country IS NULL")
	}

	if err := query.Find(&artists).Error; err != nil {
		log.Printf("DB Error: %v", err)
		return
	}

	for _, artist := range artists {
		artistName := artist.Name
		if artistName == "" || artistName == "Unknown Artist" {
			continue
		}

		log.Printf("%s Search: %s", provider, artistName)

		var resultStr string
		var err error

		if provider == "discogs" {
			resultStr, err = metadata.GetArtistCountryViaDiscogs(artistName, w.cfg.Services.DiscogsToken)
			time.Sleep(2 * time.Second)
		} else {
			resultStr, err = metadata.GetArtistCountryViaMusicBrainz(artistName, w.cfg.Services.ContactEmail)
			time.Sleep(1 * time.Second)
		}

		if err != nil || resultStr == "" {
			continue
		}

		if len(resultStr) != 2 {
			geoCode, err := utils.GetCountryFromArea(resultStr)
			if err == nil {
				resultStr = geoCode
			}
			time.Sleep(1 * time.Second)
		}

		if dryRun {
			log.Printf("[DRY RUN] Would update Artist %s to %s", artistName, resultStr)
		} else {
			// 1. Update Artist
			w.db.DB.Model(&artist).Update("ArtistCountry", resultStr)

			// 2. Update all Albums linked to this Primary Artist
			w.db.DB.Model(&models.Album{}).
				Where("artist_id = ? AND (release_country = '' OR release_country IS NULL)", artist.ID).
				Update("release_country", resultStr)

			log.Printf("Updated Artist %s to %s", artistName, resultStr)
		}
	}
}
