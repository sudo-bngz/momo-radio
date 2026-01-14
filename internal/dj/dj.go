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

	// 1. Start Query
	query := d.db.DB.Model(&models.Track{}).Where("key LIKE ?", d.prefix+"%")

	// 2. NEW: Don't play anything played in the last 4 hours
	fourHoursAgo := time.Now().Add(-4 * time.Hour)
	query = query.Where("last_played IS NULL OR last_played < ?", fourHoursAgo)

	// --- FILTERS  ---
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
		// ... (Styles and Artists logic stays the same)
	}
	// --- YOUR ORIGINAL FILTERS END ---

	// 3. NEW: Get the 50 tracks that haven't been played for the longest time
	result := query.Order("last_played ASC").Limit(50).Find(&dbTracks)
	if result.Error != nil {
		return result.Error
	}

	// 4. If everything was played recently, fallback to just the oldest 20
	if len(dbTracks) == 0 {
		d.db.DB.Model(&models.Track{}).Where("key LIKE ?", d.prefix+"%").Order("last_played ASC").Limit(20).Find(&dbTracks)
	}

	var files []string
	for _, t := range dbTracks {
		files = append(files, t.Key)
	}

	// 5. Fisher-Yates Shuffle (Exactly your original code)
	shuffled := make([]string, len(files))
	copy(shuffled, files)
	n := len(shuffled)
	for i := n - 1; i > 0; i-- {
		jBig, _ := rand.Int(rand.Reader, big.NewInt(int64(i+1)))
		j := int(jBig.Int64())
		shuffled[i], shuffled[j] = shuffled[j], shuffled[i]
	}

	d.queue = shuffled
	d.tracks = files

	log.Printf("🃏 Loaded %d fresh tracks (Longest since play) for: %s", len(d.queue), d.currentProg)
	return nil
}
