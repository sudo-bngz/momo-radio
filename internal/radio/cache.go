package radio

import (
	"io"
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// StorageProvider defines what we need from the storage layer
type StorageProvider interface {
	DownloadFile(key string) (io.ReadCloser, error)
}

type CacheManager struct {
	storage StorageProvider
	baseDir string
	mu      sync.Mutex
	pending map[string]bool // Tracks currently downloading files to avoid duplicates
}

func NewCacheManager(storage StorageProvider, tmpDir string) *CacheManager {
	cacheDir := filepath.Join(tmpDir, "track_cache")
	if err := os.MkdirAll(cacheDir, 0755); err != nil {
		log.Printf("⚠️ Failed to create cache dir: %v", err)
	}

	return &CacheManager{
		storage: storage,
		baseDir: cacheDir,
		pending: make(map[string]bool),
	}
}

// GetLocalPath returns the path to the cached file.
// If not cached, it downloads it synchronously (blocking, fallback mode).
func (c *CacheManager) GetLocalPath(key string) (string, error) {
	localPath := c.filePath(key)

	// 1. Check if exists and is valid
	if c.exists(localPath) {
		// Reset mtime to mark as recently used (for cleanup logic)
		os.Chtimes(localPath, time.Now(), time.Now())
		return localPath, nil
	}

	// 2. Download if missing (Blocking)
	log.Printf("📥 Cache Miss (Just-in-Time): Downloading %s", key)
	if err := c.download(key, localPath); err != nil {
		return "", err
	}

	return localPath, nil
}

// Prefetch downloads a list of keys in the background
func (c *CacheManager) Prefetch(keys []string) {
	for _, key := range keys {
		localPath := c.filePath(key)

		c.mu.Lock()
		isPending := c.pending[key]
		c.mu.Unlock()

		if c.exists(localPath) || isPending {
			continue
		}

		// Launch download in background
		go func(k, p string) {
			c.mu.Lock()
			c.pending[k] = true
			c.mu.Unlock()

			defer func() {
				c.mu.Lock()
				delete(c.pending, k)
				c.mu.Unlock()
			}()

			log.Printf("📥 Prefetching: %s", k)
			if err := c.download(k, p); err != nil {
				log.Printf("❌ Prefetch failed for %s: %v", k, err)
			}
		}(key, localPath)
	}
}

// Cleanup removes files not in the keepList
func (c *CacheManager) Cleanup(keepKeys []string) {
	keepMap := make(map[string]bool)
	for _, k := range keepKeys {
		keepMap[c.filePath(k)] = true
	}

	files, err := os.ReadDir(c.baseDir)
	if err != nil {
		return
	}

	for _, file := range files {
		fullPath := filepath.Join(c.baseDir, file.Name())
		if !keepMap[fullPath] {
			// Check age? Or just aggressive cleanup?
			// For now, simple cleanup of anything not in the current playlist
			os.Remove(fullPath)
		}
	}
}

func (c *CacheManager) filePath(key string) string {
	// Simple hashing or sanitization to make key safe for filesystem
	safeName := filepath.Base(key)
	return filepath.Join(c.baseDir, safeName)
}

func (c *CacheManager) exists(path string) bool {
	info, err := os.Stat(path)
	if os.IsNotExist(err) {
		return false
	}
	return !info.IsDir() && info.Size() > 0
}

func (c *CacheManager) download(key, dest string) error {
	// Create temporary file first
	tmp := dest + ".tmp"

	reader, err := c.storage.DownloadFile(key)
	if err != nil {
		return err
	}
	defer reader.Close()

	out, err := os.Create(tmp)
	if err != nil {
		return err
	}
	defer out.Close()

	// Download as fast as possible (Burst speed)
	if _, err := io.Copy(out, reader); err != nil {
		return err
	}

	// Rename to final file (Atomic)
	return os.Rename(tmp, dest)
}
