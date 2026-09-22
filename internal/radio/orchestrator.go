package radio

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
	"gorm.io/gorm"

	"momo-radio/internal/dj"
	"momo-radio/internal/logger"
	"momo-radio/internal/models"
)

type CurrentTrack struct {
	TrackID      uint   `json:"track_id"`
	Title        string `json:"title"`
	Artist       string `json:"artist"`
	PlaylistName string `json:"playlist_name"`
	StartsAt     string `json:"starts_at"`
	EndsAt       string `json:"ends_at"`
	DurationMs   int64  `json:"duration_ms"`
	ElapsedMs    int64  `json:"elapsed_ms"` // Initialized to 0 when pushed
	WaveformKey  string `json:"waveform_key"`
	CoverURL     string `json:"cover_url"`
}

func (e *Engine) runOrchestrator(ctx context.Context, orgID uuid.UUID, output *io.PipeWriter, resumeID uint) {
	defer output.Close()

	selectors := map[string]dj.Selector{
		"random":     dj.NewSelector("random", e.db.DB, orgID),
		"starvation": dj.NewSelector("starvation", e.db.DB, orgID),
	}

	var lastTrack *models.Track
	firstRun := true

	for {
		select {
		case <-ctx.Done():
			logger.Log.Info("Orchestrator loop terminated by context", zap.String("org_id", orgID.String()))
			return
		default:
			var selectedTrack *models.Track
			var err error
			currentMode := "Unknown"

			if firstRun && resumeID != 0 {
				if dbErr := e.db.DB.Preload("Artists").Where("organization_id = ?", orgID).First(&selectedTrack, resumeID).Error; dbErr == nil {
					lastTrack = selectedTrack
					currentMode = "Resume"
					logger.Log.Info("Resuming track from previous state",
						zap.String("org_id", orgID.String()),
						zap.Uint("track_id", resumeID),
					)
				}
				firstRun = false
			}

			if selectedTrack == nil {
				activeSlot := e.scheduler.GetCurrentSchedule(orgID)

				if activeSlot != nil && activeSlot.PlaylistID != nil {
					currentMode = "Playlist"
					selectedTrack, err = e.pickNextFromPlaylist(orgID, *activeSlot.PlaylistID, lastTrack)
				} else if activeSlot != nil && activeSlot.RuleSetID != nil {
					mode := "random"
					if activeSlot.RuleSet != nil && activeSlot.RuleSet.Mode != "" {
						mode = strings.ToLower(activeSlot.RuleSet.Mode)
					}
					selector, exists := selectors[mode]
					if !exists {
						selector = selectors["random"]
					}
					currentMode = selector.Name()
					selectedTrack, err = selector.PickTrack(activeSlot.RuleSet, lastTrack)
				}
			}

			if err != nil || selectedTrack == nil {
				logger.Log.Warn("Primary selection failed or nil track, falling back to pure random",
					zap.String("org_id", orgID.String()),
					zap.Error(err),
				)
				currentMode = "Fallback Random"
				selectedTrack, _ = selectors["random"].PickTrack(nil, nil)
			}

			if selectedTrack != nil && selectedTrack.ID != 0 && selectedTrack.Key != "" {
				logger.Log.Info("Now Playing",
					zap.String("org_id", orgID.String()),
					zap.String("mode", currentMode),
					zap.Uint("track_id", selectedTrack.ID),
					zap.String("title", selectedTrack.Title),
				)

				e.state.UpdateTrack(orgID, selectedTrack.ID, 0)
				e.cache.Prefetch([]string{selectedTrack.Key})
				go e.cache.Cleanup([]string{selectedTrack.Key})

				tracksPlayed.WithLabelValues(orgID.String()).Inc()

				go e.updateNowPlaying(orgID, selectedTrack, getShowName(e.scheduler.GetCurrentSchedule(orgID)))
				go e.recordTrackPlay(orgID, selectedTrack)

				lastTrack = selectedTrack

				if err := e.streamFileToPipe(selectedTrack.Key, output); err != nil {
					logger.Log.Error("Pipe stream error", zap.String("org_id", orgID.String()), zap.Error(err))
					time.Sleep(1 * time.Second)
				}
			} else {
				logger.Log.Warn("Orchestrator idle: No playable tracks found in library.", zap.String("org_id", orgID.String()))
				time.Sleep(10 * time.Second)
			}
		}
	}
}

func (e *Engine) pickNextFromPlaylist(orgID uuid.UUID, playlistID uint, lastTrack *models.Track) (*models.Track, error) {
	var track models.Track
	currentSortOrder := -1

	if lastTrack != nil {
		e.db.DB.Table("playlist_tracks").
			Select("sort_order").
			Where("playlist_id = ? AND track_id = ?", playlistID, lastTrack.ID).
			Scan(&currentSortOrder)
	}

	logger.Log.Debug("Attempting to pick next track from playlist",
		zap.Uint("playlist_id", playlistID),
		zap.Int("current_sort_order", currentSortOrder),
	)

	err := e.db.DB.Model(&models.Track{}).
		Joins("JOIN playlist_tracks ON playlist_tracks.track_id = tracks.id").
		Where("playlist_tracks.playlist_id = ? AND tracks.organization_id = ? AND playlist_tracks.sort_order > ?", playlistID, orgID, currentSortOrder).
		Preload("Artists").
		Preload("Album").
		Order("playlist_tracks.sort_order ASC").
		First(&track).Error

	if err != nil {
		logger.Log.Debug("Reached end of playlist, wrapping to beginning", zap.Uint("playlist_id", playlistID))
		err = e.db.DB.Model(&models.Track{}).
			Joins("JOIN playlist_tracks ON playlist_tracks.track_id = tracks.id").
			Where("playlist_tracks.playlist_id = ? AND tracks.organization_id = ?", playlistID, orgID).
			Preload("Artists").
			Preload("Album").
			Order("playlist_tracks.sort_order ASC").
			First(&track).Error
	}

	return &track, err
}

func (e *Engine) updateNowPlaying(orgID uuid.UUID, t *models.Track, showName string) {
	var artistNames []string
	for _, a := range t.Artists {
		artistNames = append(artistNames, a.Name)
	}
	artistStr := "Unknown Artist"
	if len(artistNames) > 0 {
		artistStr = strings.Join(artistNames, ", ")
	}

	// Calculate exact milliseconds
	now := time.Now().UTC()
	durationMs := int64(t.Duration * 1000)
	endsAt := now.Add(time.Duration(durationMs) * time.Millisecond)

	// Build the cover URL if you store relative paths in the DB.
	coverURL := t.Album.CoverURL
	if coverURL != "" && !strings.HasPrefix(coverURL, "http") {
		baseURL := strings.TrimRight(e.cfg.CDN.Assets, "/")
		coverURL = fmt.Sprintf("%s/%s", baseURL, coverURL)
	}

	trackData := CurrentTrack{
		TrackID:      t.ID,
		Title:        t.Title,
		Artist:       artistStr,
		PlaylistName: showName,
		DurationMs:   durationMs,
		ElapsedMs:    0, // Always 0 at the exact moment the track starts
		StartsAt:     now.Format(time.RFC3339),
		EndsAt:       endsAt.Format(time.RFC3339),
		WaveformKey:  t.WaveformKey,
		CoverURL:     coverURL,
	}

	data, err := json.Marshal(trackData)
	if err != nil {
		logger.Log.Error("Failed to marshal now playing", zap.Error(err))
		return
	}

	ctx := context.Background()
	key := fmt.Sprintf("radio:%s:now_playing", orgID.String())

	if err := e.rdb.Set(ctx, key, data, 24*time.Hour).Err(); err != nil {
		logger.Log.Error("Failed to set now_playing in Redis", zap.Error(err))
	}
	if err := e.rdb.Publish(ctx, key, data).Err(); err != nil {
		logger.Log.Error("Failed to publish now_playing to Redis pubsub", zap.Error(err))
	} else {
		logger.Log.Debug("Pushed now_playing update to Redis", zap.Uint("track_id", t.ID))
	}
}

func (e *Engine) recordTrackPlay(orgID uuid.UUID, t *models.Track) {
	now := time.Now()
	err := e.db.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&models.Track{}).
			Where("id = ? AND organization_id = ?", t.ID, orgID).
			Updates(map[string]any{
				"play_count":  gorm.Expr("play_count + 1"),
				"last_played": now,
			}).Error; err != nil {
			return err
		}

		history := models.PlayHistory{
			OrganizationID: orgID,
			TrackID:        t.ID,
			PlayedAt:       now,
		}
		return tx.Create(&history).Error
	})

	if err != nil {
		logger.Log.Error("Failed to record play history", zap.String("org_id", orgID.String()), zap.Error(err))
	} else {
		logger.Log.Debug("Recorded track play history successfully", zap.Uint("track_id", t.ID))
	}
}

func (e *Engine) streamFileToPipe(key string, pipe *io.PipeWriter) error {
	logger.Log.Debug("Fetching track from cache for FFmpeg pipe", zap.String("key", key))

	localPath, err := e.cache.GetLocalPath(key)
	if err != nil {
		return err
	}

	f, err := os.Open(localPath)
	if err != nil {
		return err
	}
	defer f.Close()

	logger.Log.Debug("Streaming track bytes into FFmpeg pipe", zap.String("local_path", localPath))
	_, err = io.Copy(pipe, f)
	return err
}

func getShowName(slot *models.ScheduleSlot) string {
	if slot == nil || slot.ScheduleType == "fallback" {
		return "General Rotation"
	}
	if slot.Playlist != nil {
		return slot.Playlist.Name
	}
	if slot.RuleSet != nil {
		return slot.RuleSet.Name
	}
	return "Momo Radio"
}
