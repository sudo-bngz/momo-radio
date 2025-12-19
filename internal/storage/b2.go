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
	s3           *s3.S3
	bucketProd   string
	bucketIngest string
	bucketStream string

	// Cache for file listings (Radio Engine)
	cache      map[string][]string
	cacheTime  map[string]time.Time
	cacheMutex sync.RWMutex
}

const CacheTTL = 1 * time.Hour

func New(cfg *config.Config) *Client {
	s3Config := &aws.Config{
		Credentials:      credentials.NewStaticCredentials(cfg.B2.KeyID, cfg.B2.AppKey, ""),
		Endpoint:         aws.String(cfg.B2.Endpoint),
		Region:           aws.String(cfg.B2.Region),
		S3ForcePathStyle: aws.Bool(true),
	}
	sess := session.Must(session.NewSession(s3Config))

	return &Client{
		s3:           s3.New(sess),
		bucketProd:   cfg.B2.BucketProd,
		bucketIngest: cfg.B2.BucketIngest,
		bucketStream: cfg.B2.BucketStream,
		cache:        make(map[string][]string),
		cacheTime:    make(map[string]time.Time),
	}
}

// --- Radio Engine Methods (Read-Only Cache) ---

func (c *Client) ListAudioFiles(prefix string) ([]string, error) {
	c.cacheMutex.RLock()
	files, ok := c.cache[prefix]
	ts := c.cacheTime[prefix]
	c.cacheMutex.RUnlock()

	if ok && time.Since(ts) < CacheTTL {
		return files, nil
	}

	var allKeys []string
	input := &s3.ListObjectsV2Input{
		Bucket: aws.String(c.bucketProd),
		Prefix: aws.String(prefix),
	}

	err := c.s3.ListObjectsV2Pages(input, func(page *s3.ListObjectsV2Output, lastPage bool) bool {
		for _, item := range page.Contents {
			key := *item.Key
			if strings.HasSuffix(key, ".mp3") && key != prefix {
				allKeys = append(allKeys, key)
			}
		}
		return true
	})

	if err != nil {
		return nil, err
	}

	c.cacheMutex.Lock()
	c.cache[prefix] = allKeys
	c.cacheTime[prefix] = time.Now()
	c.cacheMutex.Unlock()

	return allKeys, nil
}

// DownloadFile downloads from bucket (used by Radio Engine)
func (c *Client) DownloadFile(key string) (*s3.GetObjectOutput, error) {
	return c.s3.GetObject(&s3.GetObjectInput{
		Bucket: aws.String(c.bucketProd),
		Key:    aws.String(key),
	})
}

func (c *Client) UploadStreamFile(key string, body io.ReadSeeker, contentType, cacheControl string) error {
	_, err := c.s3.PutObject(&s3.PutObjectInput{
		Bucket:       aws.String(c.bucketStream),
		Key:          aws.String(key),
		Body:         body,
		ContentType:  aws.String(contentType),
		CacheControl: aws.String(cacheControl),
	})
	return err
}

// --- Ingester Methods (ETL Pipeline) ---

// ListIngestFiles returns all keys in the Ingest bucket (No caching)
func (c *Client) ListIngestFiles() ([]string, error) {
	var keys []string
	input := &s3.ListObjectsV2Input{
		Bucket: aws.String(c.bucketIngest),
	}
	err := c.s3.ListObjectsV2Pages(input, func(page *s3.ListObjectsV2Output, lastPage bool) bool {
		for _, item := range page.Contents {
			keys = append(keys, *item.Key)
		}
		return true
	})
	return keys, err
}

func (c *Client) DownloadIngestFile(key string) (*s3.GetObjectOutput, error) {
	return c.s3.GetObject(&s3.GetObjectInput{
		Bucket: aws.String(c.bucketIngest),
		Key:    aws.String(key),
	})
}

func (c *Client) DeleteIngestFile(key string) error {
	_, err := c.s3.DeleteObject(&s3.DeleteObjectInput{
		Bucket: aws.String(c.bucketIngest),
		Key:    aws.String(key),
	})
	return err
}
