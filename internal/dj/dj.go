package dj

import (
	"crypto/rand"
	"log"
	"math/big"
	"sync"

	"momo-radio/internal/storage"
)

type Deck struct {
	prefix string
	tracks []string
	queue  []string
	client *storage.Client
	mu     sync.Mutex
}

func NewDeck(client *storage.Client, prefix string) *Deck {
	return &Deck{
		client: client,
		prefix: prefix,
		queue:  make([]string, 0),
	}
}

func (d *Deck) NextTrack() string {
	d.mu.Lock()
	defer d.mu.Unlock()

	if len(d.queue) == 0 {
		log.Printf("🔄 Deck empty for %s. Reshuffling...", d.prefix)
		if err := d.refreshAndShuffle(); err != nil {
			log.Printf("❌ Error refreshing deck %s: %v", d.prefix, err)
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

func (d *Deck) refreshAndShuffle() error {
	files, err := d.client.ListAudioFiles(d.prefix)
	if err != nil {
		return err
	}
	if len(files) == 0 {
		return nil
	}

	shuffled := make([]string, len(files))
	copy(shuffled, files)

	// Secure Fisher-Yates Shuffle
	n := len(shuffled)
	for i := n - 1; i > 0; i-- {
		jBig, err := rand.Int(rand.Reader, big.NewInt(int64(i+1)))
		if err != nil {
			break
		}
		j := int(jBig.Int64())
		shuffled[i], shuffled[j] = shuffled[j], shuffled[i]
	}

	d.queue = shuffled
	d.tracks = files
	return nil
}
