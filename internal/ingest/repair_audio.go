package ingest

import (
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"

	"momo-radio/internal/audio"
	"momo-radio/internal/models"
)

// RepairAudio finds tracks missing acoustic metadata (BPM, Duration, Key)
// downloads the master file, runs Essentia, and updates the database.
func (w *Worker) RepairAudio() {
	var tracks []models.Track

	// Find tracks that are missing core acoustic data
	if err := w.db.DB.Where("bpm = 0 OR duration = 0 OR musical_key = ''").Find(&tracks).Error; err != nil {
		log.Fatalf("Failed to fetch tracks for audio repair: %v", err)
	}

	if len(tracks) == 0 {
		log.Println("All tracks have acoustic data. Nothing to repair!")
		return
	}

	log.Printf("Starting Audio Repair (Essentia) for %d tracks...", len(tracks))

	for _, track := range tracks {
		log.Printf("Repairing Audio for Track ID %d...", track.ID)

		// 1. Download the file
		tempPath := filepath.Join(w.cfg.Server.TempDir, fmt.Sprintf("audio_repair_%d.raw", track.ID))
		fileStream, err := w.storage.DownloadFile(track.Key)
		if err != nil {
			log.Printf("Failed to download master file for track %d: %v", track.ID, err)
			continue
		}

		outFile, err := os.Create(tempPath)
		if err != nil {
			log.Printf("Failed to create temp file for track %d: %v", track.ID, err)
			continue
		}

		_, err = io.Copy(outFile, fileStream.Body)
		outFile.Close()
		fileStream.Body.Close()

		if err != nil {
			log.Printf("Failed to write temp file for track %d: %v", track.ID, err)
			os.Remove(tempPath)
			continue
		}

		// 2. Run Essentia
		w.analysisSem <- struct{}{}
		analysis, err := audio.AnalyzeDeep(tempPath)
		<-w.analysisSem

		os.Remove(tempPath) // Clean up immediately

		if err != nil {
			log.Printf("Essentia analysis failed for track %d: %v", track.ID, err)
			continue
		}

		// 3. Save to Database
		err = w.db.DB.Model(&track).Updates(map[string]interface{}{
			"bpm":          analysis.BPM,
			"duration":     analysis.Duration,
			"musical_key":  analysis.MusicalKey,
			"scale":        analysis.Scale,
			"danceability": analysis.Danceability,
			"loudness":     analysis.Loudness,
		}).Error

		if err != nil {
			log.Printf("Failed to save audio data for track %d: %v", track.ID, err)
		} else {
			log.Printf("Successfully repaired audio data for track %d (BPM: %.1f, Key: %s)", track.ID, analysis.BPM, analysis.MusicalKey)
		}
	}

	log.Println("Audio repair complete.")
}
