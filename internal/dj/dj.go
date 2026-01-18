package dj

import (
	"crypto/rand"
	"log"
	"math/big"
	"sync"
	"time"

	database "momo-radio/internal/db"
	"momo-radio/internal/models"
	"momo-radio/internal/storage"

	"gorm.io/gorm"
)

type Deck struct {
	prefix      string
	tracks      []string
	queue       []string
	client      *storage.Client
	db          *database.Client
	mu          sync.Mutex
	scheduler   *Scheduler
	currentProg string
}

func NewDeck(client *storage.Client, db *database.Client, prefix string) *Deck {
	var sched *Scheduler
	if prefix == "music/" {
		sched = NewScheduler(db)
	}

	return &Deck{
		client:    client,
		db:        db,
		prefix:    prefix,
		queue:     make([]string, 0),
		scheduler: sched,
	}
}

func (d *Deck) NextTrack() string {
	d.mu.Lock()
	defer d.mu.Unlock()

	var criteria *ActiveCriteria
	newProgName := "General Rotation"

	if d.scheduler != nil {
		criteria = d.scheduler.GetCurrentCriteria()
		if criteria != nil {
			newProgName = criteria.Name
		}
	}

	if d.currentProg != newProgName {
		log.Printf("📻 Program Change: [%s] -> [%s]. Flushing queue.", d.currentProg, newProgName)
		d.queue = []string{}
		d.currentProg = newProgName
	}

	if len(d.queue) == 0 {
		if err := d.refreshAndShuffle(criteria); err != nil {
			log.Printf("❌ Error refreshing deck: %v", err)
			return ""
		}
	}

	if len(d.queue) == 0 {
		return ""
	}

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

func (d *Deck) refreshAndShuffle(criteria *ActiveCriteria) error {
	var dbTracks []models.Track

	// --- 1. EXCLUSION LOGIC (Artist Separation) ---
	// Fetch last 10 tracks to ensure good spacing
	var recentHistory []models.PlayHistory
	var excludedArtists []string

	// Increased lookback from 5 to 10 for better artist spacing
	d.db.DB.Preload("Track").Order("played_at DESC").Limit(10).Find(&recentHistory)
	for _, h := range recentHistory {
		if h.Track.Artist != "" {
			excludedArtists = append(excludedArtists, h.Track.Artist)
		}
	}

	// --- 2. BUILD THE QUERY ---
	query := d.db.DB.Model(&models.Track{}).Where("key LIKE ?", d.prefix+"%")

	// A. Apply Criteria (Genre, Year, etc)
	if criteria != nil {
		if criteria.Genre != "" {
			query = query.Where("genre = ?", criteria.Genre)
		}
		if criteria.Publisher != "" {
			query = query.Where("publisher ILIKE ?", "%"+criteria.Publisher+"%")
		}
		if criteria.MinYear > 0 {
			query = query.Where("year::int >= ?", criteria.MinYear)
		}
		if criteria.MaxYear > 0 {
			query = query.Where("year::int <= ?", criteria.MaxYear)
		}
		if len(criteria.Styles) > 0 {
			query = query.Where(func(db *gorm.DB) *gorm.DB {
				for i, style := range criteria.Styles {
					if i == 0 {
						db = db.Where("genre ILIKE ?", "%"+style+"%")
					} else {
						db = db.Or("genre ILIKE ?", "%"+style+"%")
					}
				}
				return db
			})
		}
	}

	// B. Apply Exclusions
	// 1. Hard Lockout: Don't play anything played in the last 12 hours (Stricter than 4h)
	// This forces the system to dig deeper into the library.
	twelveHoursAgo := time.Now().Add(-12 * time.Hour)
	query = query.Where("last_played IS NULL OR last_played < ?", twelveHoursAgo)

	// 2. Artist Lockout
	if len(excludedArtists) > 0 {
		query = query.Where("artist NOT IN ?", excludedArtists)
	}

	// --- 3. THE "FAIRNESS" SORTING MAGIC ---
	// sort by:
	// 1. Play Count ASC (Tracks played 0 times come first)
	// 2. Last Played ASC (Oldest played tracks come first)
	// 3. NULLS FIRST (Ensure tracks never played are at the absolute top)

	// fetch a "Candidate Pool" of 300.
	// only fetched 50, the playlist would be predictable (always the oldest).
	// Fetching 300 starved tracks and shuffling them gives us fairness + variety.
	result := query.Order("play_count ASC, last_played ASC NULLS FIRST").Limit(300).Find(&dbTracks)

	// --- 4. FALLBACK STRATEGY ---
	// If criteria are too strict (result empty), relax strictness but keep fairness logic
	if result.Error != nil || len(dbTracks) == 0 {
		log.Printf("⚠️ Rules too strict for [%s]. Relaxing constraints.", d.prefix)

		fallbackQuery := d.db.DB.Model(&models.Track{}).Where("key LIKE ?", d.prefix+"%")

		// Still try to respect criteria if possible, or strip them here if necessary.
		// For now, we just remove the Time Lockout and Artist Lockout to find *something*.
		if criteria != nil && criteria.Genre != "" {
			fallbackQuery = fallbackQuery.Where("genre = ?", criteria.Genre)
		}

		// Just get the absolute oldest/least played tracks
		fallbackQuery.Order("play_count ASC, last_played ASC NULLS FIRST").Limit(100).Find(&dbTracks)
	}

	if len(dbTracks) == 0 {
		log.Printf("❌ CRITICAL: No tracks found in DB for prefix: %s", d.prefix)
		return nil
	}

	// --- 5. SHUFFLE THE CANDIDATE POOL ---
	// We have the 300 most "starved" songs. Now shuffle them so we don't
	// always play them in exact chronological order of their last play.

	// Fisher-Yates Shuffle
	n := len(dbTracks)
	for i := n - 1; i > 0; i-- {
		jBig, _ := rand.Int(rand.Reader, big.NewInt(int64(i+1)))
		j := int(jBig.Int64())
		dbTracks[i], dbTracks[j] = dbTracks[j], dbTracks[i]
	}

	// Limit queue to 50 items to keep the rotation fresh
	// (If we load 300, the last one won't play for 24 hours, effectively locking it)
	queueSize := min(50, len(dbTracks))
	d.queue = make([]string, queueSize)
	for i := 0; i < queueSize; i++ {
		d.queue[i] = dbTracks[i].Key
	}

	log.Printf("🃏 Deck Refreshed: [%s] | Loaded: %d | Candidates Found: %d", d.currentProg, queueSize, n)
	return nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
