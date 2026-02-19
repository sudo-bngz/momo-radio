package storage

import (
	"io"
	"os"
	"path/filepath"
	"strings"
)

type LocalProvider struct {
	// RootPath is the directory where buckets are simulated (e.g., "./data")
	RootPath string
}

func NewLocalProvider(root string) *LocalProvider {
	// Ensure the root directory exists
	_ = os.MkdirAll(root, 0755)
	return &LocalProvider{RootPath: root}
}

func (l *LocalProvider) List(bucket, prefix string) ([]string, error) {
	var keys []string
	bucketPath := filepath.Join(l.RootPath, bucket)

	// We walk the bucket directory to find files
	err := filepath.Walk(bucketPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}

		// Convert OS path back to S3-style key (forward slashes)
		rel, _ := filepath.Rel(bucketPath, path)
		key := filepath.ToSlash(rel)

		if strings.HasPrefix(key, prefix) {
			keys = append(keys, key)
		}
		return nil
	})

	return keys, err
}

func (l *LocalProvider) Get(bucket, key string) (*FileObject, error) {
	path := filepath.Join(l.RootPath, bucket, key)
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}

	stat, err := f.Stat()
	if err != nil {
		f.Close()
		return nil, err
	}

	return &FileObject{
		Body:          f,
		ContentLength: stat.Size(),
		ContentType:   "application/octet-stream", // Local files usually don't store this
		LastModified:  stat.ModTime(),
	}, nil
}

func (l *LocalProvider) Put(bucket, key string, body io.ReadSeeker, contentType, cacheControl string) error {
	path := filepath.Join(l.RootPath, bucket, key)

	// Ensure sub-directories exist (e.g. bucket/folder/file.mp3)
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}

	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()

	_, err = io.Copy(f, body)
	return err
}

func (l *LocalProvider) Delete(bucket, key string) error {
	return os.Remove(filepath.Join(l.RootPath, bucket, key))
}

func (l *LocalProvider) Exists(bucket, prefix string) (bool, error) {
	path := filepath.Join(l.RootPath, bucket, prefix)
	info, err := os.Stat(path)
	if os.IsNotExist(err) {
		return true, nil // Prefix is empty because it doesn't exist
	}
	if err != nil {
		return false, err
	}

	if info.IsDir() {
		// Check if directory is empty
		f, err := os.Open(path)
		if err != nil {
			return false, err
		}
		defer f.Close()
		_, err = f.Readdirnames(1)
		return err == io.EOF, nil
	}

	return false, nil // It's a file, so prefix isn't "empty"
}
