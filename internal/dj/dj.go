package dj

import (
	"crypto/rand"
	"log"
	"math/big"
	"sync"

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
	limit := n
	if limit > len(d.queue) {
		limit = len(d.queue)
	}
	result := make([]string, limit)
	copy(result, d.queue[:limit])
	return result
}

func (d *Deck) refreshAndShuffle(criteria *ActiveCriteria) error {
	var dbTracks []models.Track

	// Start Query
	query := d.db.DB.Model(&models.Track{}).Where("key LIKE ?", d.prefix+"%")

	// Apply Schedule Filters
	if criteria != nil {
		if criteria.Genre != "" {
			query = query.Where("genre = ?", criteria.Genre)
		}

		// Use ILIKE for partial matches on Publisher/Label
		if criteria.Publisher != "" {
			query = query.Where("publisher ILIKE ?", "%"+criteria.Publisher+"%")
		}

		if criteria.MinYear > 0 {
			query = query.Where("year::int >= ?", criteria.MinYear)
		}
		if criteria.MaxYear > 0 {
			query = query.Where("year::int <= ?", criteria.MaxYear)
		}

		// Multiple Styles (OR logic: track matches ANY of the styles)
		// Grouped to avoid breaking other AND conditions
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

		// Multiple Artists (OR logic: track matches ANY of the artists)
		if len(criteria.Artists) > 0 {
			query = query.Where(func(db *gorm.DB) *gorm.DB {
				for i, artist := range criteria.Artists {
					if i == 0 {
						db = db.Where("artist ILIKE ?", "%"+artist+"%")
					} else {
						db = db.Or("artist ILIKE ?", "%"+artist+"%")
					}
				}
				return db
			})
		}
	}

	result := query.Find(&dbTracks)
	if result.Error != nil {
		return result.Error
	}

	var files []string
	for _, t := range dbTracks {
		files = append(files, t.Key)
	}

	if len(files) == 0 {
		log.Printf("⚠️ No tracks found for criteria: %s", d.currentProg)
		return nil
	}

	// Fisher-Yates Shuffle
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

	log.Printf("🃏 Loaded & Shuffled %d tracks for program: %s", len(d.queue), d.currentProg)
	return nil
}
