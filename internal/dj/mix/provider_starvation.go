package mix

import (
	"crypto/rand"
	"errors"
	"log"
	"math/big"
	"sync"
	"time"

	"momo-radio/internal/dj"
	"momo-radio/internal/models"

	"gorm.io/gorm"
)

// StarvationProvider implements "Pure Starvation" strategy.
// It simply looks for tracks with the lowest play count and oldest last_played date.
type StarvationProvider struct {
	prefix string
	queue  []models.Track
	db     *gorm.DB
	mu     sync.Mutex
}

func NewStarvationProvider(db *gorm.DB, prefix string) *StarvationProvider {
	return &StarvationProvider{
		db:     db,
		prefix: prefix,
		queue:  make([]models.Track, 0),
	}
}

func (s *StarvationProvider) Name() string {
	return "Pure Starvation"
}

func (s *StarvationProvider) GetNextTrack() (*dj.Track, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// 1. Check if we need to refill
	if len(s.queue) == 0 {
		if err := s.refillDeck(); err != nil {
			log.Printf("❌ Error refreshing deck: %v", err)
			return nil, err
		}
	}

	if len(s.queue) == 0 {
		return nil, errors.New("queue is empty (no tracks found)")
	}

	// 2. Pop the first track
	selected := s.queue[0]
	s.queue = s.queue[1:]

	return &dj.Track{
		ID:       selected.ID,
		Key:      selected.Key,
		Artist:   selected.Artist,
		Title:    selected.Title,
		Duration: time.Duration(selected.Duration) * time.Second,
	}, nil
}

func (s *StarvationProvider) refillDeck() error {
	var dbTracks []models.Track

	// --- 1. BUILD QUERY ---
	query := s.db.Model(&models.Track{}).Where("key LIKE ?", s.prefix+"%")

	// --- 2. APPLY ARTIST SEPARATION
	// I don't want to play the same artist back-to-back.
	// Check the last 10 tracks played globally.
	var recentHistory []models.PlayHistory
	var excludedArtists []string

	if err := s.db.Preload("Track").Order("played_at DESC").Limit(10).Find(&recentHistory).Error; err == nil {
		for _, h := range recentHistory {
			if h.Track.Artist != "" {
				excludedArtists = append(excludedArtists, h.Track.Artist)
			}
		}
	}
	if len(excludedArtists) > 0 {
		query = query.Where("artist NOT IN ?", excludedArtists)
	}

	// --- 3. FETCH THE "HUNGRY" TRACKS ---
	// Sort by PlayCount (Low -> High), then by LastPlayed (Old -> New)
	result := query.Order("play_count ASC, last_played ASC NULLS FIRST").Limit(100).Find(&dbTracks)

	if result.Error != nil || len(dbTracks) == 0 {
		// Fallback: If artist exclusion was too strict, try again without it
		fallbackQuery := s.db.Model(&models.Track{}).Where("key LIKE ?", s.prefix+"%")
		fallbackQuery.Order("play_count ASC, last_played ASC NULLS FIRST").Limit(50).Find(&dbTracks)
	}

	if len(dbTracks) == 0 {
		return errors.New("no tracks found in library")
	}

	// --- 4. SHUFFLE THE RESULTS ---
	n := len(dbTracks)
	for i := n - 1; i > 0; i-- {
		jBig, _ := rand.Int(rand.Reader, big.NewInt(int64(i+1)))
		j := int(jBig.Int64())
		dbTracks[i], dbTracks[j] = dbTracks[j], dbTracks[i]
	}

	// --- 5. FILL QUEUE ---
	s.queue = dbTracks
	log.Printf("🃏 Starvation Deck Refreshed | Loaded: %d", len(s.queue))
	return nil
}
