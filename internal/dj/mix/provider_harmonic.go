package mix

import (
	"errors"
	"fmt"
	"log"
	"math/rand"
	"sort"
	"sync"
	"time"

	"momo-radio/internal/audio"
	"momo-radio/internal/dj"
	"momo-radio/internal/models"

	"gorm.io/gorm"
)

// TimeProfile defines the target audio metrics for a specific time of day
type TimeProfile struct {
	Name        string
	MinBPM      float64
	MaxBPM      float64
	MinDance    float64 // 0.0 to 1.0
	MinLoudness float64 // e.g. -12dB is quieter than -6dB
	ScalePref   string  // "major", "minor", or "" (any)
}

// HarmonicDailyProvider manages time-based energy flow using your audio package
type HarmonicDailyProvider struct {
	db *gorm.DB
	mu sync.Mutex
	// We don't keep a long queue because the "MixScore" depends on the exact previous track.
	// We calculate the best Next track on the fly.
}

func NewHarmonicDailyProvider(db *gorm.DB) *HarmonicDailyProvider {
	return &HarmonicDailyProvider{
		db: db,
	}
}

func (h *HarmonicDailyProvider) Name() string {
	profile := h.getCurrentProfile(time.Now().Hour())
	return fmt.Sprintf("Harmonic Daily (%s)", profile.Name)
}

func (h *HarmonicDailyProvider) GetNextTrack() (*dj.Track, error) {
	h.mu.Lock()
	defer h.mu.Unlock()

	// 1. Get Context
	profile := h.getCurrentProfile(time.Now().Hour())

	// 2. Get Last Played Track (The Anchor)
	var lastPlayed models.PlayHistory
	var prevTrack models.Track
	hasPrev := false

	if err := h.db.Preload("Track").Order("played_at DESC").First(&lastPlayed).Error; err == nil {
		prevTrack = lastPlayed.Track
		hasPrev = true
	}

	// 3. Fetch Candidates (The Vibe Filter)
	// We ask for ~50 tracks that fit the CURRENT time constraints.
	candidates, err := h.fetchCandidates(profile, prevTrack)
	if err != nil {
		return nil, err
	}

	// 4. Select Best Match (The Harmonic Selector)
	var selected models.Track

	if hasPrev {
		// Use your audio package to score them
		// We define a lightweight structure to hold the track and its score
		type ScoredTrack struct {
			Track models.Track
			Score float64
		}

		scoredCandidates := make([]ScoredTrack, len(candidates))

		for i, c := range candidates {
			// Lower score is better (audio package logic)
			score := audio.CalculateMixScore(prevTrack, c)
			scoredCandidates[i] = ScoredTrack{Track: c, Score: score}
		}

		// Sort by Score (Ascending: Lowest score first)
		sort.Slice(scoredCandidates, func(i, j int) bool {
			return scoredCandidates[i].Score < scoredCandidates[j].Score
		})

		// Pick the winner (or one of the top 3 to keep some variety)
		// Let's pick the absolute best for tight mixing
		selected = scoredCandidates[0].Track

		log.Printf("🎚️ Harmonic Mix: [%s] -> [%s] | Score: %.2f | Profile: %s",
			prevTrack.Title, selected.Title, scoredCandidates[0].Score, profile.Name)

	} else {
		// If no history (startup), just pick a random one from valid candidates
		selected = candidates[rand.Intn(len(candidates))]
	}

	return &dj.Track{
		ID:       selected.ID,
		Key:      selected.Key,
		Artist:   selected.Artist,
		Title:    selected.Title,
		Duration: time.Duration(selected.Duration) * time.Second,
	}, nil
}

func (h *HarmonicDailyProvider) fetchCandidates(p TimeProfile, exclude models.Track) ([]models.Track, error) {
	var tracks []models.Track

	query := h.db.Model(&models.Track{}).
		Where("bpm BETWEEN ? AND ?", p.MinBPM, p.MaxBPM).
		Where("danceability >= ?", p.MinDance).
		Where("loudness >= ?", p.MinLoudness)

	if p.ScalePref != "" {
		// Assumes DB has "mode" column: "major"/"minor"
		query = query.Where("mode = ?", p.ScalePref)
	}

	// Don't play the exact same track again
	if exclude.ID != 0 {
		query = query.Where("id != ?", exclude.ID)
	}

	// Fetch a pool of random candidates that fit the profile
	// We fetch 50 so the audio.CalculateMixScore has enough options to find a harmonic match
	if err := query.Order("RANDOM()").Limit(50).Find(&tracks).Error; err != nil {
		return nil, err
	}

	if len(tracks) == 0 {
		// Fallback: If strict profile yields nothing, try relaxing constraints (removing mode/loudness)
		log.Printf("⚠️ Strict profile [%s] empty. Relaxing constraints.", p.Name)
		fallbackQuery := h.db.Model(&models.Track{}).
			Where("bpm BETWEEN ? AND ?", p.MinBPM-10, p.MaxBPM+10). // Wider BPM
			Order("RANDOM()").Limit(20)

		if err := fallbackQuery.Find(&tracks).Error; err != nil || len(tracks) == 0 {
			return nil, errors.New("no tracks found even after relaxing rules")
		}
	}

	return tracks, nil
}

// getCurrentProfile maps the hour (0-23) to a specific mood
func (h *HarmonicDailyProvider) getCurrentProfile(hour int) TimeProfile {
	switch {
	// 06:00 - 10:00 -> Morning Glow (Soft, Major, Groovy)
	case hour >= 6 && hour < 10:
		return TimeProfile{
			Name:        "Morning Glow",
			MinBPM:      90,
			MaxBPM:      122,
			MinDance:    0.3,
			MinLoudness: -14.0,
			ScalePref:   "major",
		}

	// 10:00 - 18:00 -> Daytime Work/Flow (Neutral, steady beat)
	case hour >= 10 && hour < 18:
		return TimeProfile{
			Name:        "Daytime Flow",
			MinBPM:      110,
			MaxBPM:      128,
			MinDance:    0.5,
			MinLoudness: -12.0,
			ScalePref:   "", // Any scale
		}

	// 18:00 - 22:00 -> Evening Warmup (Building energy)
	case hour >= 18 && hour < 22:
		return TimeProfile{
			Name:        "Evening Warmup",
			MinBPM:      120,
			MaxBPM:      130,
			MinDance:    0.7,
			MinLoudness: -9.0,
			ScalePref:   "",
		}

	// 22:00 - 04:00 -> Peak Time (Fast, Loud, Minor/Driving)
	case hour >= 22 || hour < 4:
		return TimeProfile{
			Name:        "Peak Time",
			MinBPM:      126,
			MaxBPM:      145,
			MinDance:    0.75,
			MinLoudness: -8.5,
			ScalePref:   "minor",
		}

	// 04:00 - 06:00 -> Late Night / Comedown
	default:
		return TimeProfile{
			Name:        "Deep Night",
			MinBPM:      110,
			MaxBPM:      124,
			MinDance:    0.6,
			MinLoudness: -11.0,
			ScalePref:   "minor",
		}
	}
}
