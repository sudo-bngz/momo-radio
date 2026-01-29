package mix

import (
	"crypto/rand"
	"errors"
	"fmt"
	"log"
	"math"
	"math/big"
	"strings"
	"sync"
	"time"

	database "momo-radio/internal/db"
	"momo-radio/internal/dj"
	"momo-radio/internal/models"
	"momo-radio/internal/storage"
)

// Deck implements the dj.Provider interface
type Deck struct {
	prefix      string
	queue       []models.Track
	client      *storage.Client
	db          *database.Client
	scheduler   *Scheduler // <--- Added this field
	mu          sync.Mutex
	currentProg string
}

// NewDeck creates a new harmonic mixing deck
func NewDeck(client *storage.Client, db *database.Client, prefix string) *Deck {
	// Initialize the real scheduler using the GORM DB instance
	sched := NewScheduler(db.DB)

	return &Deck{
		client:    client,
		db:        db,
		prefix:    prefix,
		scheduler: sched, // <--- Store it here
		queue:     make([]models.Track, 0),
	}
}

// Name satisfies the dj.Provider interface
func (d *Deck) Name() string {
	if d.currentProg != "" {
		return "Harmonic Deck (" + d.currentProg + ")"
	}
	return "Harmonic Deck"
}

// GetNextTrack satisfies the dj.Provider interface
func (d *Deck) GetNextTrack() (*dj.Track, error) {
	d.mu.Lock()
	defer d.mu.Unlock()

	// 1. Check Scheduler for Rules (Using the real method now)
	// We dereference (*) because GetCurrentRules returns a pointer, but buildHarmonicSet expects a value
	currentSlot := *d.scheduler.GetCurrentRules()

	// 2. Detect Program Change
	if d.currentProg != currentSlot.Name {
		if d.currentProg != "" {
			log.Printf("📻 Program Change: [%s] -> [%s]. Flushing queue.", d.currentProg, currentSlot.Name)
			d.queue = []models.Track{}
		}
		d.currentProg = currentSlot.Name
	}

	// 3. Refill Queue if empty
	if len(d.queue) == 0 {
		if err := d.buildHarmonicSet(currentSlot); err != nil {
			log.Printf("❌ Error building set: %v", err)
			return nil, err
		}
	}

	if len(d.queue) == 0 {
		return nil, errors.New("queue is empty")
	}

	// 4. Pop Track
	selected := d.queue[0]
	d.queue = d.queue[1:]

	return &dj.Track{
		ID:       selected.ID,
		Key:      selected.Key,
		Artist:   selected.Artist,
		Title:    selected.Title,
		Duration: time.Duration(selected.Duration) * time.Second,
	}, nil
}

// buildHarmonicSet fetches and sorts tracks based on the rules
func (d *Deck) buildHarmonicSet(rules dj.SlotRules) error {
	var pool []models.Track

	// A. Build Query
	query := d.db.DB.Model(&models.Track{}).Where("key LIKE ?", d.prefix+"%")

	operator := "ILIKE"
	if d.db.DB.Dialector.Name() == "sqlite" {
		operator = "LIKE"
	}

	// Apply Styles
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

	// Apply BPM
	if rules.MinBPM > 0 {
		query = query.Where("bpm >= ?", rules.MinBPM)
	}
	if rules.MaxBPM > 0 {
		query = query.Where("bpm <= ?", rules.MaxBPM)
	}

	// 12h Lockout
	twelveHoursAgo := time.Now().Add(-12 * time.Hour)
	query = query.Where("last_played IS NULL OR last_played < ?", twelveHoursAgo)

	// Fetch Candidates
	result := query.Order("play_count ASC, last_played ASC NULLS FIRST").Limit(200).Find(&pool)

	// Fallback
	if result.Error != nil || len(pool) < 5 {
		log.Printf("⚠️ Rules too strict for [%s]. Relaxing.", rules.Name)
		d.db.DB.Model(&models.Track{}).
			Where("key LIKE ?", d.prefix+"%").
			Where("last_played IS NULL OR last_played < ?", twelveHoursAgo).
			Limit(50).
			Find(&pool)
	}

	if len(pool) == 0 {
		return errors.New("no tracks found in library")
	}

	// B. Random Start
	seedRange := min(20, len(pool))
	seedIdxBig, _ := rand.Int(rand.Reader, big.NewInt(int64(seedRange)))
	seedIdx := int(seedIdxBig.Int64())

	playlist := []models.Track{pool[seedIdx]}
	currentTrack := pool[seedIdx]
	pool = append(pool[:seedIdx], pool[seedIdx+1:]...)

	// C. Greedy Chain
	for len(playlist) < 50 && len(pool) > 0 {
		bestIdx := -1
		bestScore := 100000.0
		scanLimit := min(len(pool), 50)

		for i := 0; i < scanLimit; i++ {
			candidate := pool[i]

			if candidate.Artist != "" && candidate.Artist == currentTrack.Artist {
				continue
			}

			score := calculateMixScore(currentTrack, candidate)
			if score < bestScore {
				bestScore = score
				bestIdx = i
			}
		}

		if bestIdx == -1 {
			bestIdx = 0
		}

		nextTrack := pool[bestIdx]
		playlist = append(playlist, nextTrack)
		currentTrack = nextTrack
		pool = append(pool[:bestIdx], pool[bestIdx+1:]...)
	}

	d.queue = playlist
	log.Printf("🃏 Built Set [%s]: %d tracks starting with %s", rules.Name, len(d.queue), d.queue[0].Title)
	return nil
}

// Internal Helpers

func calculateMixScore(a, b models.Track) float64 {
	score := 0.0
	bpmDiff := math.Abs(a.BPM - b.BPM)
	score += bpmDiff * 2.0
	return score
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
