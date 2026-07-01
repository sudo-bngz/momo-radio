package utils

import (
	"net/url"
	"strings"

	"momo-radio/internal/config"
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

// BuildLiveURL extracts the Stream bucket and region from config for the direct URL
func (b *CDNBuilder) BuildLiveURL(key, orgID string) string {
	directURL := b.store.GetDirectPublicURL(b.cfg.Storage.BucketStream, key)
	return b.build(b.cfg.CDN.Stream, directURL, key, orgID)
}

// BuildAssetURL extracts the Prod bucket and region from config for the direct URL
func (b *CDNBuilder) BuildAssetURL(key, orgID string) string {
	directURL := b.store.GetDirectPublicURL(b.cfg.Storage.BucketAssets, key)
	return b.build(b.cfg.CDN.Assets, directURL, key, orgID) // Note: Make sure cfg.CDN.AssetsURL matches your config struct field name
}

// Internal private logic
func (b *CDNBuilder) build(cdnBaseURL, directStorageURL, key, orgID string) string {
	if key == "" {
		return ""
	}

	var rawURL string

	// 1. Production: CDN is toggled ON
	if b.cfg.CDN.Enabled && cdnBaseURL != "" {
		baseURL := strings.TrimRight(cdnBaseURL, "/")

		// ⚡️ THE BUG FIX: Bulletproof the scheme
		// If the config forgot to include http:// or https://, force it to https://
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
