package ingest

import (
	"fmt"
	"io"
	"os"
	"path/filepath"

	"go.uber.org/zap"

	"momo-radio/internal/audio"
	"momo-radio/internal/logger"
	"momo-radio/internal/models"
)

// RepairAudio finds tracks missing acoustic metadata (BPM, Duration, Key)
// downloads the master file, runs Essentia, and updates the database.
func (w *Worker) RepairAudio() {
	var tracks []models.Track

	// Find tracks that are missing core acoustic data
	if err := w.db.DB.Where("bpm = 0 OR duration = 0 OR musical_key = ''").Find(&tracks).Error; err != nil {
		logger.Log.Fatal("Failed to fetch tracks for audio repair", zap.Error(err))
	}

	if len(tracks) == 0 {
		logger.Log.Info("All tracks have acoustic data. Nothing to repair!")
		return
	}

	logger.Log.Info("Starting Audio Repair (Essentia)", zap.Int("track_count", len(tracks)))

	for _, track := range tracks {
		logger.Log.Info("Repairing Audio for Track", zap.Any("track_id", track.ID))

		// 1. Download the file
		// Using %v in case track.ID is a UUID string rather than an integer
		tempPath := filepath.Join(w.cfg.Server.TempDir, fmt.Sprintf("audio_repair_%v.raw", track.ID))
		fileStream, err := w.storage.DownloadFile(track.Key)
		if err != nil {
			logger.Log.Error("Failed to download master file", zap.Any("track_id", track.ID), zap.Error(err))
			continue
		}

		outFile, err := os.Create(tempPath)
		if err != nil {
			logger.Log.Error("Failed to create temp file", zap.Any("track_id", track.ID), zap.Error(err))
			fileStream.Body.Close() // Close stream to prevent memory leak
			continue
		}

		_, err = io.Copy(outFile, fileStream.Body)
		outFile.Close()
		fileStream.Body.Close()

		if err != nil {
			logger.Log.Error("Failed to write temp file", zap.Any("track_id", track.ID), zap.Error(err))
			os.Remove(tempPath)
			continue
		}

		// 2. Run Essentia
		w.analysisSem <- struct{}{}
		analysis, err := audio.AnalyzeDeep(tempPath)
		<-w.analysisSem

		os.Remove(tempPath) // Clean up immediately

		if err != nil {
			logger.Log.Error("Essentia analysis failed", zap.Any("track_id", track.ID), zap.Error(err))
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
			logger.Log.Error("Failed to save audio data", zap.Any("track_id", track.ID), zap.Error(err))
		} else {
			logger.Log.Info("Successfully repaired audio data",
				zap.Any("track_id", track.ID),
				zap.Float64("bpm", analysis.BPM),
				zap.String("musical_key", analysis.MusicalKey),
			)
		}
	}

	logger.Log.Info("Audio repair complete.")
}
