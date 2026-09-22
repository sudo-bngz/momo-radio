package radio

import (
	"io"
	"os"
	"path/filepath"
	"sync"
	"time"

	"go.uber.org/zap"

	"momo-radio/internal/logger"
)

// StorageProvider defines what we need from the storage layer
type StorageProvider interface {
	DownloadFile(key string) (io.ReadCloser, error)
}

type CacheManager struct {
	storage StorageProvider
	baseDir string
	mu      sync.Mutex
	pending map[string]chan struct{}
}

func NewCacheManager(storage StorageProvider, tmpDir string) *CacheManager {
	cacheDir := filepath.Join(tmpDir, "track_cache")
	if err := os.MkdirAll(cacheDir, 0755); err != nil {
		logger.Log.Error("Failed to create cache directory",
			zap.String("dir", cacheDir),
			zap.Error(err),
		)
	}

	return &CacheManager{
		storage: storage,
		baseDir: cacheDir,
		pending: make(map[string]chan struct{}),
	}
}

func (c *CacheManager) GetLocalPath(key string) (string, error) {
	localPath := c.filePath(key)

	// 1. Check if it already exists
	if c.exists(localPath) {
		os.Chtimes(localPath, time.Now(), time.Now())
		logger.Log.Debug("Cache Hit", zap.String("key", key))
		return localPath, nil
	}

	// 2. Check if it's currently being downloaded by Prefetch
	c.mu.Lock()
	waitCh, isDownloading := c.pending[key]
	if isDownloading {
		c.mu.Unlock()
		logger.Log.Debug("Waiting for existing download to complete", zap.String("key", key))
		<-waitCh              // Wait for the other goroutine to finish
		return localPath, nil // Return now that it's downloaded
	}

	// 3. Not exists and not downloading: Register our intent to download
	done := make(chan struct{})
	c.pending[key] = done
	c.mu.Unlock()

	defer func() {
		close(done)
		c.mu.Lock()
		delete(c.pending, key)
		c.mu.Unlock()
	}()

	logger.Log.Info("Cache Miss: Downloading track", zap.String("key", key))
	if err := c.download(key, localPath); err != nil {
		logger.Log.Error("Failed to download track to cache",
			zap.String("key", key),
			zap.Error(err),
		)
		return "", err
	}

	return localPath, nil
}

func (c *CacheManager) Prefetch(keys []string) {
	for _, key := range keys {
		go func(k string) {
			logger.Log.Debug("Prefetching track", zap.String("key", k))
			_, err := c.GetLocalPath(k)
			if err != nil {
				logger.Log.Warn("Prefetch failed",
					zap.String("key", k),
					zap.Error(err),
				)
			}
		}(key)
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
		logger.Log.Error("Failed to read cache directory for cleanup", zap.Error(err))
		return
	}

	cleanedCount := 0
	for _, file := range files {
		fullPath := filepath.Join(c.baseDir, file.Name())
		if !keepMap[fullPath] {
			// Check age? Or just aggressive cleanup?
			// For now, simple cleanup of anything not in the current playlist
			if err := os.Remove(fullPath); err == nil {
				cleanedCount++
			} else {
				logger.Log.Warn("Failed to delete stale cache file",
					zap.String("file", file.Name()),
					zap.Error(err),
				)
			}
		}
	}

	if cleanedCount > 0 {
		logger.Log.Debug("Cleaned up stale tracks from cache", zap.Int("count", cleanedCount))
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
