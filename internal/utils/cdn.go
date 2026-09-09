package utils

import (
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"momo-radio/internal/config"

	"github.com/google/uuid"
)

// DirectURLProvider perfectly matches your storage.Client signature
type DirectURLProvider interface {
	GetDirectPublicURL(bucket, key string) string
}

type CDNBuilder struct {
	cfg   *config.Config
	store DirectURLProvider
}

// NewCDNBuilder accepts the config and the interface matching your storage client
func NewCDNBuilder(cfg *config.Config, store DirectURLProvider) *CDNBuilder {
	return &CDNBuilder{
		cfg:   cfg,
		store: store,
	}
}

// GetHLSStreamURL replaces the old bucket-based Live URL logic.
// It returns the direct MediaMTX URL or routes through the BunnyCDN Stream zone if enabled.
func (b *CDNBuilder) GetHLSStreamURL(orgID uuid.UUID, mountSlug string) string {
	if mountSlug == "" {
		mountSlug = "radio"
	}

	baseURL := b.cfg.MediaMTX.HLSURL
	if baseURL == "" {
		baseURL = "http://localhost:8888"
	}

	// Route through BunnyCDN pull zone if enabled
	if b.cfg.CDN.Enabled && b.cfg.CDN.Stream != "" {
		baseURL = b.cfg.CDN.Stream
	}

	baseURL = strings.TrimRight(baseURL, "/")

	// Ensure protocol prefix is present
	if !strings.HasPrefix(baseURL, "http://") && !strings.HasPrefix(baseURL, "https://") {
		baseURL = "https://" + baseURL
	}

	return fmt.Sprintf("%s/%s/%s/index.m3u8", baseURL, orgID.String(), mountSlug)
}

// BuildAssetURL extracts the Prod bucket and region from config for the direct URL (used for cover art, audio tracks, etc.)
func (b *CDNBuilder) BuildAssetURL(key, orgID string) string {
	directURL := b.store.GetDirectPublicURL(b.cfg.Storage.BucketAssets, key)
	return b.build(b.cfg.CDN.Assets, directURL, key, orgID)
}

// Internal private logic for static assets
func (b *CDNBuilder) build(cdnBaseURL, directStorageURL, key, orgID string) string {
	if key == "" {
		return ""
	}

	var rawURL string

	// 1. Production: CDN is toggled ON
	if b.cfg.CDN.Enabled && cdnBaseURL != "" {
		baseURL := strings.TrimRight(cdnBaseURL, "/")

		if !strings.HasPrefix(baseURL, "http://") && !strings.HasPrefix(baseURL, "https://") {
			baseURL = "https://" + baseURL
		}

		cleanKey := strings.TrimLeft(key, "/")
		rawURL = baseURL + "/" + cleanKey
	} else {
		// 2. Fallback: Direct URL provided by the storage interface
		rawURL = directStorageURL
	}

	if rawURL == "" {
		return ""
	}

	// Append the orgID query parameter safely for middleware bypass
	if orgID != "" {
		parsedURL, err := url.Parse(rawURL)
		if err == nil {
			q := parsedURL.Query()
			q.Add("org_id", orgID)
			parsedURL.RawQuery = q.Encode()
			return parsedURL.String()
		}
	}

	return rawURL
}

// PurgeCache sends a native HTTP request to BunnyCDN to clear a specific file
func (c *CDNBuilder) PurgeCache(fullFileURL string) error {
	apiKey := c.cfg.CDN.APIKey
	if apiKey == "" || !c.cfg.CDN.Enabled {
		return nil // Skip gracefully if CDN is disabled
	}

	// BunnyCDN requires the exact full URL escaped in the query parameter
	reqURL := fmt.Sprintf("https://api.bunny.net/purge?url=%s", url.QueryEscape(fullFileURL))

	req, err := http.NewRequest("POST", reqURL, nil)
	if err != nil {
		return err
	}
	req.Header.Add("AccessKey", apiKey)

	// Use a short timeout so we don't hang the worker
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("BunnyCDN purge failed with status: %d", resp.StatusCode)
	}

	return nil
}
