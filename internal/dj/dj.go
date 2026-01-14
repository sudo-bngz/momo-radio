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

	// --- 1. ARTIST SEPARATION LOGIC ---
	// Look at the last 5 tracks played to create a lockout list
	var recentHistory []models.PlayHistory
	var excludedArtists []string
	d.db.DB.Preload("Track").Order("played_at DESC").Limit(5).Find(&recentHistory)
	for _, h := range recentHistory {
		if h.Track.Artist != "" {
			excludedArtists = append(excludedArtists, h.Track.Artist)
		}
	}

	// --- 2. THE MAIN SMART QUERY ---
	// Start with the mandatory prefix (separates music from jingles)
	query := d.db.DB.Model(&models.Track{}).Where("key LIKE ?", d.prefix+"%")

	// Apply Repetition Protection (4h window)
	fourHoursAgo := time.Now().Add(-4 * time.Hour)
	query = query.Where("last_played IS NULL OR last_played < ?", fourHoursAgo)

	// Apply Artist Separation
	if len(excludedArtists) > 0 {
		query = query.Where("artist NOT IN ?", excludedArtists)
	}

	// Apply Schedule Filters (Genre, Year, etc.)
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

		// Styles and Artists OR logic
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

	// EXECUTE: Get 100 random tracks that pass all strict rules
	result := query.Order("RANDOM()").Limit(100).Find(&dbTracks)

	// --- 3. EMERGENCY FALLBACK ---
	// If result is empty (library too small or filters too strict), we IGNORE rules
	// but KEEP the prefix so we don't play jingles as music.
	if result.Error != nil || len(dbTracks) == 0 {
		log.Printf("⚠️ Rules too strict for [%s]. Falling back to oldest tracks.", d.prefix)
		d.db.DB.Model(&models.Track{}).
			Where("key LIKE ?", d.prefix+"%"). // Mandatory prefix check
			Order("last_played ASC").          // Get songs that waited the longest
			Limit(100).
			Find(&dbTracks)
	}

	// --- 4. SHUFFLE & LOAD ---
	if len(dbTracks) == 0 {
		log.Printf("❌ CRITICAL: No tracks found in DB for prefix: %s", d.prefix)
		return nil
	}

	// Fisher-Yates Shuffle the final batch in-memory
	n := len(dbTracks)
	for i := n - 1; i > 0; i-- {
		jBig, _ := rand.Int(rand.Reader, big.NewInt(int64(i+1)))
		j := int(jBig.Int64())
		dbTracks[i], dbTracks[j] = dbTracks[j], dbTracks[i]
	}

	// Fill the queue
	d.queue = make([]string, len(dbTracks))
	for i, t := range dbTracks {
		d.queue[i] = t.Key
	}

	log.Printf("🃏 Deck Ready: [%s] | Tracks: %d | Artist Separation: %d songs", d.currentProg, len(d.queue), len(excludedArtists))
	return nil
}
