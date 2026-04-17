package storage

import (
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
	// Make sure the arguments here match what you want to use
	GetPublicURL(bucket, key string) string
}

// Object is the provider-agnostic representation of a file.
type FileObject struct {
	Body          io.ReadCloser
	ContentLength int64
	ContentType   string
	LastModified  time.Time
}
