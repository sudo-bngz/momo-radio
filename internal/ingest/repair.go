package ingest

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"

	"github.com/hibiken/asynq"

	"momo-radio/internal/audio"
	"momo-radio/internal/models"
)

// RepairMetadata scans existing tracks, generates acoustic fingerprints,
// and pushes them through the new deterministic waterfall pipeline.
func (w *Worker) RepairMetadata() {
	var tracks []models.Track

	// Preload Artists so we can pass the local name to the payload
	if err := w.db.DB.Preload("Artists").Find(&tracks).Error; err != nil {
		log.Fatalf("Failed to fetch tracks for repair: %v", err)
	}

	log.Printf("Starting Metadata Repair for %d tracks...", len(tracks))

	for _, track := range tracks {
		log.Printf("Repairing Track ID %d...", track.ID)

		// 1. We need the physical file for fpcalc.
		tempPath := filepath.Join(w.cfg.Server.TempDir, fmt.Sprintf("repair_%d.raw", track.ID))

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
		if err != nil {
			log.Printf("Failed to copy file data to disk for track %d: %v", track.ID, err)
		}

		outFile.Close()
		fileStream.Body.Close()
		// 2. Generate the Acoustic Fingerprint
		mbid, err := audio.GetMusicBrainzID(tempPath, w.cfg.Services.AcoustIDKey)
		if err != nil {
			log.Printf("Could not fingerprint track %d (Skipping): %v", track.ID, err)
		} else {
			log.Printf("Fingerprint SUCCESS for track %d: [%s]", track.ID, mbid)
		}

		// Clean up the temp file immediately so we don't blow up the server disk
		os.Remove(tempPath)

		// 3. Prepare the Payload
		artistName := "Unknown"
		if len(track.Artists) > 0 {
			artistName = track.Artists[0].Name
		}

		payload := localTrackEnrichPayload{
			TrackID:       track.ID,
			ArtistName:    artistName,
			TrackTitle:    track.Title,
			MusicBrainzID: mbid, // ⚡️ The golden ticket
		}

		// 4. Fire it into the Asynq Queue!
		payloadBytes, _ := json.Marshal(payload)
		task := asynq.NewTask("track:enrich", payloadBytes)

		if _, err := w.asynqClient.Enqueue(task); err != nil {
			log.Printf("Failed to enqueue repair task for track %d: %v", track.ID, err)
		}
	}

	log.Println("Metadata repair jobs successfully enqueued. Check your Asynq dashboard!")
}
