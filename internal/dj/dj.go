package dj

import (
	"crypto/rand"
	"fmt"
	"log"
	"math/big"
	"strings"
	"sync"
	"time"

	database "momo-radio/internal/db"
	"momo-radio/internal/models"
	"momo-radio/internal/storage"
)

type Deck struct {
	prefix      string
	queue       []string
	client      *storage.Client
	db          *database.Client
	mu          sync.Mutex
	currentProg string
}

func NewDeck(client *storage.Client, db *database.Client, prefix string) *Deck {
	// We no longer need the internal scheduler struct since we use the global Timetable
	return &Deck{
		client: client,
		db:     db,
		prefix: prefix,
		queue:  make([]string, 0),
	}
}

func (d *Deck) NextTrack() string {
	d.mu.Lock()
	defer d.mu.Unlock()

	// 1. Check the Timetable for the current slot rules
	currentSlot := GetCurrentSlot(time.Now())

	// 2. Detect Program Change
	// If the show name changed (e.g. Morning -> Afternoon), we flush the queue
	// to ensure the new mood starts immediately.
	if d.currentProg != currentSlot.Name {
		if d.currentProg != "" {
			log.Printf("📻 Program Change: [%s] -> [%s]. Flushing queue.", d.currentProg, currentSlot.Name)
			d.queue = []string{}
		}
		d.currentProg = currentSlot.Name
	}

	// 3. Refill Queue if empty
	if len(d.queue) == 0 {
		if err := d.buildHarmonicSet(currentSlot); err != nil {
			log.Printf("❌ Error refreshing deck: %v", err)
			return ""
		}
	}

	if len(d.queue) == 0 {
		return ""
	}

	// 4. Pop the next track
	track := d.queue[0]
	d.queue = d.queue[1:]
	return track
}

func (d *Deck) Peek(n int) []string {
	d.mu.Lock()
	defer d.mu.Unlock()
	if len(d.queue) == 0 {
		return []string{}
	}
	limit := min(n, len(d.queue))
	result := make([]string, limit)
	copy(result, d.queue[:limit])
	return result
}

// buildHarmonicSet replaces the old refreshAndShuffle.
// It fetches a pool of tracks matching the slot rules and arranges them musically.
func (d *Deck) buildHarmonicSet(rules SlotRules) error {
	var pool []models.Track

	// --- 1. FETCH CANDIDATE POOL ---
	query := d.db.DB.Model(&models.Track{}).Where("key LIKE ?", d.prefix+"%")

	// A. Apply Style/Genre Filters (DIALECT AWARE)
	if len(rules.Styles) > 0 {
		var conditions []string
		var args []interface{}

		// Check which database we are using to choose the correct operator.
		// Postgres uses ILIKE for case-insensitivity.
		// SQLite uses LIKE (which is case-insensitive by default for ASCII).
		operator := "ILIKE"
		if d.db.DB.Dialector.Name() == "sqlite" {
			operator = "LIKE"
		}

		for _, style := range rules.Styles {
			// We check both Genre and Style tags for flexibility.
			// e.g. (style ILIKE ? OR genre ILIKE ?)
			clause := fmt.Sprintf("(style %s ? OR genre %s ?)", operator, operator)
			conditions = append(conditions, clause)

			val := "%" + style + "%"
			args = append(args, val, val)
		}

		// Join all style conditions with OR: "(A) OR (B) OR (C)"
		sql := strings.Join(conditions, " OR ")

		// Wrap the whole thing in brackets to avoid logic errors with other WHERE clauses
		query = query.Where("("+sql+")", args...)
	}

	// B. Apply BPM Range
	if rules.MinBPM > 0 {
		query = query.Where("bpm >= ?", rules.MinBPM)
	}
	if rules.MaxBPM > 0 {
		query = query.Where("bpm <= ?", rules.MaxBPM)
	}

	// C. Exclusion Logic (12h lockout)
	// Don't play tracks played in the last 12 hours
	twelveHoursAgo := time.Now().Add(-12 * time.Hour)
	query = query.Where("last_played IS NULL OR last_played < ?", twelveHoursAgo)

	// D. Fetch
	// Sort by play_count ASC ensures we rotate the whole library eventually.
	// Limit 200 gives us enough variety to find harmonic matches.
	result := query.Order("play_count ASC, last_played ASC NULLS FIRST").Limit(200).Find(&pool)

	// --- 2. FALLBACK STRATEGY ---
	// If rules are too strict (empty pool or DB error), relax them to avoid silence.
	if result.Error != nil || len(pool) < 10 {
		log.Printf("⚠️ Rules too strict for [%s]. Relaxing constraints.", rules.Name)
		pool = []models.Track{} // Clear partial results

		// Fallback: Just get the oldest played tracks regardless of BPM/Style
		// We still keep the prefix (music/) and the 12h lockout if possible,
		// but drop the genre/bpm requirements.
		d.db.DB.Model(&models.Track{}).
			Where("key LIKE ?", d.prefix+"%").
			Where("last_played IS NULL OR last_played < ?", twelveHoursAgo).
			Order("last_played ASC").
			Limit(50).
			Find(&pool)
	}

	if len(pool) == 0 {
		log.Printf("❌ CRITICAL: No tracks found in DB for prefix: %s", d.prefix)
		return nil
	}

	// --- 3. THE GREEDY CHAIN BUILDER ---
	// Instead of shuffling, we build a set where Track A -> Track B is harmonically sound.

	// Step A: Pick a random "Seed" track from the top 20 most starved tracks.
	// This ensures the set starts differently every time.
	seedRange := min(20, len(pool))
	seedIdxBig, _ := rand.Int(rand.Reader, big.NewInt(int64(seedRange)))
	seedIdx := int(seedIdxBig.Int64())

	// Start the playlist
	playlist := []models.Track{pool[seedIdx]}
	currentTrack := pool[seedIdx]

	// Remove seed from pool
	pool = append(pool[:seedIdx], pool[seedIdx+1:]...)

	// Step B: Loop to fill the queue
	targetQueueSize := 50
	for len(playlist) < targetQueueSize && len(pool) > 0 {
		bestIdx := -1
		bestScore := 100000.0 // Higher is worse

		// Optimization: Only scan the first 50 candidates in the pool to save CPU.
		// Since the pool is already sorted by "Need to play", scanning the top 50
		// balances "fairness" with "mix quality".
		scanLimit := min(len(pool), 50)

		for i := 0; i < scanLimit; i++ {
			candidate := pool[i]

			// Rule: Prevent same artist back-to-back
			if candidate.Artist == currentTrack.Artist {
				continue
			}

			// Calculate Harmonic/BPM Score
			score := CalculateMixScore(currentTrack, candidate)

			// Add Jitter (+/- 5.0) to prevent deterministic chains
			// (e.g., if Song A always leads to Song B, it gets boring)
			jitterBig, _ := rand.Int(rand.Reader, big.NewInt(10))
			score += float64(jitterBig.Int64()) - 5.0

			if score < bestScore {
				bestScore = score
				bestIdx = i
			}
		}

		// If no valid candidate found (e.g. all same artist), just pick the first one
		if bestIdx == -1 {
			bestIdx = 0
		}

		// Append winner to playlist
		nextTrack := pool[bestIdx]
		playlist = append(playlist, nextTrack)
		currentTrack = nextTrack

		// Remove from pool
		pool = append(pool[:bestIdx], pool[bestIdx+1:]...)
	}

	// --- 4. POPULATE QUEUE ---
	d.queue = make([]string, len(playlist))
	for i, t := range playlist {
		d.queue[i] = t.Key
	}

	log.Printf("🃏 Set Built: [%s] | Tracks: %d | Starting with: %s", rules.Name, len(d.queue), d.queue[0])
	return nil
}
