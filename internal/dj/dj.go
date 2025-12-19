package dj

import (
	"crypto/rand" // Secure random number generator
	"log"
	"math/big"
	"sync"

	database "momo-radio/internal/db"
	"momo-radio/internal/models"
	"momo-radio/internal/storage"
)

type Deck struct {
	prefix string
	tracks []string // The full list of tracks
	queue  []string // The current "to play" list
	client *storage.Client
	db     *database.Client
	mu     sync.Mutex
}

func NewDeck(client *storage.Client, db *database.Client, prefix string) *Deck {
	return &Deck{
		client: client,
		db:     db,
		prefix: prefix,
		queue:  make([]string, 0),
	}
}

// NextTrack returns a track from the shuffled queue.
// If the queue is empty, it refetches and reshuffles.
func (d *Deck) NextTrack() string {
	d.mu.Lock()
	defer d.mu.Unlock()

	// Refill queue if empty
	if len(d.queue) == 0 {
		log.Printf("🔄 Deck empty for %s. Reshuffling library...", d.prefix)
		if err := d.refreshAndShuffle(); err != nil {
			log.Printf("❌ Error refreshing deck %s: %v", d.prefix, err)
			return "" // Caller should handle empty/retry
		}
	}

	// Pop the first item
	if len(d.queue) == 0 {
		return "" // Still empty? Library issue.
	}
	track := d.queue[0]
	d.queue = d.queue[1:]

	// log.Printf("DEBUG: Remaining in %s queue: %d", d.prefix, len(d.queue))
	return track
}

func (d *Deck) refreshAndShuffle() error {
	var dbTracks []models.Track
	result := d.db.DB.Model(&models.Track{}).Where("key LIKE ?", d.prefix+"%").Find(&dbTracks)
	if result.Error != nil {
		return result.Error
	}

	var files []string
	for _, t := range dbTracks {
		files = append(files, t.Key)
	}

	if len(files) == 0 {
		return nil
	}

	// Create a copy to shuffle
	shuffled := make([]string, len(files))
	copy(shuffled, files)

	// Secure Fisher-Yates Shuffle using crypto/rand
	n := len(shuffled)
	for i := n - 1; i > 0; i-- {
		// Generate a random index from 0 to i (inclusive)
		jBig, err := rand.Int(rand.Reader, big.NewInt(int64(i+1)))
		if err != nil {
			// Fallback if OS entropy fails (extremely rare)
			log.Printf("⚠️ Crypto/Rand failed, strictly sequential fallback: %v", err)
			break
		}
		j := int(jBig.Int64())

		// Swap
		shuffled[i], shuffled[j] = shuffled[j], shuffled[i]
	}

	d.queue = shuffled
	d.tracks = files

	log.Printf("🃏 Shuffled %d tracks from Database for %s", len(d.tracks), d.prefix)
	return nil
}
