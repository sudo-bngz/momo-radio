package mix

import (
	"crypto/rand"
	"errors"
	"fmt"
	"log"
	"math/big"
	"strings"
	"sync"
	"time"

	"momo-radio/internal/dj"
	"momo-radio/internal/models"

	"gorm.io/gorm"
)

// StarvationProvider implements the "Smart Random" strategy.
type StarvationProvider struct {
	prefix      string
	queue       []models.Track
	db          *gorm.DB
	mu          sync.Mutex
	scheduler   *Scheduler
	currentProg string
}

// NewStarvationProvider initializes the provider.
func NewStarvationProvider(db *gorm.DB, prefix string) *StarvationProvider {
	var sched *Scheduler
	if prefix == "music/" {
		sched = NewScheduler(db)
	}

	return &StarvationProvider{
		db:        db,
		prefix:    prefix,
		queue:     make([]models.Track, 0),
		scheduler: sched,
	}
}

func (s *StarvationProvider) Name() string {
	if s.currentProg != "" {
		return "Starvation (" + s.currentProg + ")"
	}
	return "Starvation (General)"
}

func (s *StarvationProvider) GetNextTrack() (*dj.Track, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// FIX 1: Use dj.SlotRules instead of ActiveCriteria
	var rules *dj.SlotRules
	newProgName := "General Rotation"

	// FIX 2: Call the new GetCurrentRules method
	if s.scheduler != nil {
		rules = s.scheduler.GetCurrentRules()
		if rules != nil {
			newProgName = rules.Name
		}
	}

	// 2. Detect Program Change -> Flush Queue
	if s.currentProg != newProgName {
		log.Printf("📻 Program Change: [%s] -> [%s]. Flushing queue.", s.currentProg, newProgName)
		s.queue = []models.Track{}
		s.currentProg = newProgName
	}

	// 3. Refill Queue if empty
	if len(s.queue) == 0 {
		// FIX 3: Pass 'rules' instead of 'criteria'
		if err := s.refreshAndShuffle(rules); err != nil {
			log.Printf("❌ Error refreshing deck: %v", err)
			return nil, err
		}
	}

	if len(s.queue) == 0 {
		return nil, errors.New("queue is empty (no tracks found)")
	}

	// 5. Pop the first track
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

// FIX 4: Update signature to accept *dj.SlotRules
func (s *StarvationProvider) refreshAndShuffle(rules *dj.SlotRules) error {
	var dbTracks []models.Track

	// --- 1. EXCLUSION LOGIC ---
	var recentHistory []models.PlayHistory
	var excludedArtists []string

	if err := s.db.Preload("Track").Order("played_at DESC").Limit(10).Find(&recentHistory).Error; err == nil {
		for _, h := range recentHistory {
			if h.Track.Artist != "" {
				excludedArtists = append(excludedArtists, h.Track.Artist)
			}
		}
	}

	// --- 2. BUILD QUERY ---
	query := s.db.Model(&models.Track{}).Where("key LIKE ?", s.prefix+"%")

	// Dialect check for case-insensitive search
	operator := "ILIKE"
	if s.db.Dialector.Name() == "sqlite" {
		operator = "LIKE"
	}

	// FIX 5: Use 'rules' fields
	if rules != nil {
		if rules.Genre != "" {
			query = query.Where("genre = ?", rules.Genre)
		}
		// SlotRules doesn't usually have Publisher, but if you added it, uncomment:
		// if rules.Publisher != "" { query = query.Where("publisher ILIKE ?", "%"+rules.Publisher+"%") }

		if rules.MinYear > 0 {
			query = query.Where("year::int >= ?", rules.MinYear)
		}
		if rules.MaxYear > 0 {
			query = query.Where("year::int <= ?", rules.MaxYear)
		}

		if len(rules.Styles) > 0 {
			var conditions []string
			var args []interface{}
			for _, style := range rules.Styles {
				conditions = append(conditions, fmt.Sprintf("(style %s ? OR genre %s ?)", operator, operator))
				val := "%" + style + "%"
				args = append(args, val, val)
			}
			query = query.Where("("+strings.Join(conditions, " OR ")+")", args...)
		}
	}

	// --- 3. APPLY EXCLUSIONS ---
	twelveHoursAgo := time.Now().Add(-12 * time.Hour)
	query = query.Where("last_played IS NULL OR last_played < ?", twelveHoursAgo)

	if len(excludedArtists) > 0 {
		query = query.Where("artist NOT IN ?", excludedArtists)
	}

	// --- 4. FETCH CANDIDATES ---

	result := query.Order("play_count ASC, last_played ASC NULLS FIRST").Limit(300).Find(&dbTracks)

	// --- 5. FALLBACK STRATEGY ---
	if result.Error != nil || len(dbTracks) == 0 {
		log.Printf("⚠️ Strict rules failed for [%s]. Relaxing.", s.prefix)

		// Simple fallback: just match prefix
		fallbackQuery := s.db.Model(&models.Track{}).Where("key LIKE ?", s.prefix+"%")

		// Try to keep Genre if possible
		if rules != nil && rules.Genre != "" {
			fallbackQuery = fallbackQuery.Where("genre = ?", rules.Genre)
		}

		fallbackQuery.Order("play_count ASC, last_played ASC NULLS FIRST").Limit(100).Find(&dbTracks)
	}

	if len(dbTracks) == 0 {
		return errors.New("no tracks found in library")
	}

	// --- 6. FISHER-YATES SHUFFLE ---
	n := len(dbTracks)
	for i := n - 1; i > 0; i-- {
		jBig, _ := rand.Int(rand.Reader, big.NewInt(int64(i+1)))
		j := int(jBig.Int64())
		dbTracks[i], dbTracks[j] = dbTracks[j], dbTracks[i]
	}

	// --- 7. FILL QUEUE ---
	queueSize := min(50, len(dbTracks))
	s.queue = dbTracks[:queueSize]

	log.Printf("🃏 Deck Refreshed: [%s] | Loaded: %d | Pool: %d", s.currentProg, queueSize, n)
	return nil
}
