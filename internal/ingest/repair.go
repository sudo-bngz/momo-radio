package ingest

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/hibiken/asynq"
	"go.uber.org/zap"

	"momo-radio/internal/audio"
	"momo-radio/internal/logger"
	"momo-radio/internal/models"
)

// RepairMetadata scans existing tracks, generates acoustic fingerprints,
// and pushes them through the new deterministic waterfall pipeline.
func (w *Worker) RepairMetadata() {
	var tracks []models.Track

	// Preload Artists so we can pass the local name to the payload
	if err := w.db.DB.Preload("Artists").Find(&tracks).Error; err != nil {
		logger.Log.Fatal("Failed to fetch tracks for repair", zap.Error(err))
	}

	logger.Log.Info("Starting Metadata Repair", zap.Int("track_count", len(tracks)))

	for _, track := range tracks {
		logger.Log.Info("Repairing Track", zap.Any("track_id", track.ID))

		// 1. We need the physical file for fpcalc.
		tempPath := filepath.Join(w.cfg.Server.TempDir, fmt.Sprintf("repair_%v.raw", track.ID))

		fileStream, err := w.storage.DownloadFile(track.Key)
		if err != nil {
			logger.Log.Error("Failed to download master file", zap.Any("track_id", track.ID), zap.Error(err))
			continue
		}

		outFile, err := os.Create(tempPath)
		if err != nil {
			logger.Log.Error("Failed to create temp file", zap.Any("track_id", track.ID), zap.Error(err))
			fileStream.Body.Close()
			continue
		}

		_, err = io.Copy(outFile, fileStream.Body)
		if err != nil {
			logger.Log.Error("Failed to copy file data to disk", zap.Any("track_id", track.ID), zap.Error(err))
		}

		outFile.Close()
		fileStream.Body.Close()

		// 2. Generate the Acoustic Fingerprint
		mbid, err := audio.GetMusicBrainzID(tempPath, w.cfg.Services.AcoustIDKey)
		if err != nil {
			logger.Log.Warn("Could not fingerprint track (Skipping)", zap.Any("track_id", track.ID), zap.Error(err))
		} else {
			logger.Log.Info("Fingerprint SUCCESS", zap.Any("track_id", track.ID), zap.String("mbid", mbid))
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
			logger.Log.Error("Failed to enqueue repair task", zap.Any("track_id", track.ID), zap.Error(err))
		}
	}

	logger.Log.Info("Metadata repair jobs successfully enqueued. Check your Asynq dashboard!")
}
