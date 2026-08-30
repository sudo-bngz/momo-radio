package storage

import (
	"context"
	"io"
	"time"
)

// StorageProvider defines the behavior for any storage backend.
type StorageProvider interface {
	List(bucket, prefix string) ([]string, error)
	Get(bucket, key string) (*FileObject, error)
	Put(bucket, key string, body io.ReadSeeker, contentType, cacheControl string) error
	Delete(bucket, key string) error
	Exists(bucket, prefix string) (bool, error)
}

type LinkableProvider interface {
	GetPublicURL(bucket, region, key string) string
}

type PresignableProvider interface {
	GeneratePresignedPutURL(ctx context.Context, bucket, key, contentType string, expiry time.Duration) (string, error)
}

// Object is the provider-agnostic representation of a file.
type FileObject struct {
	Body          io.ReadCloser
	ContentLength int64
	ContentType   string
	LastModified  time.Time
}
