package storage

import (
	"io"
	"strings"
	"sync"
	"time"

	"momo-radio/internal/config"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
)

type Client struct {
	backend      StorageProvider
	bucketProd   string
	bucketIngest string
	bucketStream string

	cache      map[string][]string
	cacheTime  map[string]time.Time
	cacheMutex sync.RWMutex
}

const CacheTTL = 1 * time.Hour

func New(cfg *config.Config) *Client {
	var backend StorageProvider

	// 1. Internal Selection Logic
	if cfg.Storage.Provider == "local" {
		backend = &LocalProvider{RootPath: cfg.Storage.LocalStorage}
	} else {
		// Defaulting to S3/B2 for retro-compatibility
		s3Config := &aws.Config{
			Credentials:      credentials.NewStaticCredentials(cfg.Storage.KeyID, cfg.Storage.AppKey, ""),
			Endpoint:         aws.String(cfg.Storage.Endpoint),
			Region:           aws.String(cfg.Storage.Region),
			S3ForcePathStyle: aws.Bool(true),
		}
		sess := session.Must(session.NewSession(s3Config))
		backend = &S3Provider{api: s3.New(sess)}
	}

	return &Client{
		backend:      backend,
		bucketProd:   cfg.Storage.BucketProd,
		bucketIngest: cfg.Storage.BucketIngest,
		bucketStream: cfg.Storage.BucketStream,
		cache:        make(map[string][]string),
		cacheTime:    make(map[string]time.Time),
	}
}

// --- Radio Engine Methods ---

func (c *Client) ListAudioFiles(prefix string) ([]string, error) {
	c.cacheMutex.RLock()
	files, ok := c.cache[prefix]
	ts := c.cacheTime[prefix]
	c.cacheMutex.RUnlock()

	if ok && time.Since(ts) < CacheTTL {
		return files, nil
	}

	keys, err := c.backend.List(c.bucketProd, prefix)
	if err != nil {
		return nil, err
	}

	var allKeys []string
	for _, key := range keys {
		if strings.HasSuffix(key, ".mp3") && key != prefix {
			allKeys = append(allKeys, key)
		}
	}

	c.cacheMutex.Lock()
	c.cache[prefix] = allKeys
	c.cacheTime[prefix] = time.Now()
	c.cacheMutex.Unlock()

	return allKeys, nil
}

func (c *Client) DownloadFile(key string) (*FileObject, error) {
	return c.backend.Get(c.bucketProd, key)
}

func (c *Client) UploadStreamFile(key string, body io.ReadSeeker, contentType, cacheControl string) error {
	return c.backend.Put(c.bucketStream, key, body, contentType, cacheControl)
}

func (c *Client) UploadAssetFile(key string, body io.ReadSeeker, contentType, cacheControl string) error {
	return c.backend.Put(c.bucketProd, key, body, contentType, cacheControl)
}

// --- Ingester Methods ---

func (c *Client) UploadIngestFile(key string, body io.ReadSeeker, contentType string) error {
	return c.backend.Put(c.bucketIngest, key, body, contentType, "")
}

func (c *Client) ListIngestFiles() ([]string, error) {
	return c.backend.List(c.bucketIngest, "")
}

func (c *Client) DownloadIngestFile(key string) (*FileObject, error) {
	return c.backend.Get(c.bucketIngest, key)
}

func (c *Client) DeleteIngestFile(key string) error {
	return c.backend.Delete(c.bucketIngest, key)
}

func (c *Client) IsPrefixEmpty(prefix string) (bool, error) {
	return c.backend.Exists(c.bucketIngest, prefix)
}
