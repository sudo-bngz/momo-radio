package utils

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"momo-radio/internal/config"
	"momo-radio/internal/logger"
)

type DirectURLProvider interface {
	// Used for generating public asset links (like cover art)
	GetDirectPublicURL(bucket, key string) string

	// Used as a fallback for streaming tracks when the CDN is disabled
	GeneratePresignedUrl(ctx context.Context, bucket string, key string, contentType string, expiry time.Duration) (string, error)
}

type CDNBuilder struct {
	cfg   *config.Config
	store DirectURLProvider
}

func NewCDNBuilder(cfg *config.Config, store DirectURLProvider) *CDNBuilder {
	return &CDNBuilder{
		cfg:   cfg,
		store: store,
	}
}

func (b *CDNBuilder) GetHLSStreamURL(orgID uuid.UUID, mountSlug string) string {
	if mountSlug == "" {
		mountSlug = "radio"
	}

	baseURL := b.cfg.MediaMTX.HLSURL
	if baseURL == "" {
		baseURL = "http://localhost:8888"
	}

	if b.cfg.CDN.Enabled && b.cfg.CDN.Stream != "" {
		baseURL = b.cfg.CDN.Stream
	}

	baseURL = strings.TrimRight(baseURL, "/")

	if !strings.HasPrefix(baseURL, "http://") && !strings.HasPrefix(baseURL, "https://") {
		baseURL = "https://" + baseURL
	}

	finalURL := fmt.Sprintf("%s/%s/%s/index.m3u8", baseURL, orgID.String(), mountSlug)

	logger.Log.Debug("Constructed HLS Stream URL",
		zap.String("org_id", orgID.String()),
		zap.String("mount", mountSlug),
		zap.String("url", finalURL),
	)

	return finalURL
}

func (b *CDNBuilder) BuildAssetURL(key, orgID string) string {
	directURL := b.store.GetDirectPublicURL(b.cfg.Storage.BucketAssets, key)
	return b.build(b.cfg.CDN.Assets, directURL, key, orgID)
}

func (b *CDNBuilder) BuildTrackStreamURL(ctx context.Context, key, orgID string) (string, error) {
	if b.cfg.CDN.Enabled {
		return b.BuildAssetURL(key, orgID), nil
	}

	return b.store.GeneratePresignedUrl(ctx, b.cfg.Storage.BucketAssets, key, "", 2*time.Hour)
}

func (b *CDNBuilder) build(cdnBaseURL, directStorageURL, key, orgID string) string {
	if key == "" {
		return ""
	}

	var rawURL string

	if b.cfg.CDN.Enabled && cdnBaseURL != "" {
		baseURL := strings.TrimRight(cdnBaseURL, "/")

		if !strings.HasPrefix(baseURL, "http://") && !strings.HasPrefix(baseURL, "https://") {
			baseURL = "https://" + baseURL
		}

		cleanKey := strings.TrimLeft(key, "/")
		rawURL = baseURL + "/" + cleanKey
	} else {
		rawURL = directStorageURL
	}

	if rawURL == "" {
		return ""
	}

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

// PrewarmCache pulls the asset through the CDN edge node immediately
// Call this asynchronously right after a track finishes processing/uploading.
func (b *CDNBuilder) PrewarmCache(key, orgID string) {
	if !b.cfg.CDN.Enabled {
		return // No CDN to warm
	}

	targetURL := b.BuildAssetURL(key, orgID)
	if targetURL == "" {
		return
	}

	// Run in a goroutine so it doesn't block the caller
	go func(urlToWarm string) {
		logger.Log.Debug("Pre-warming CDN cache", zap.String("url", urlToWarm))

		client := &http.Client{Timeout: 10 * time.Second}
		resp, err := client.Get(urlToWarm)

		if err != nil {
			logger.Log.Warn("Failed to pre-warm CDN", zap.Error(err), zap.String("url", urlToWarm))
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode == http.StatusOK {
			logger.Log.Debug("Successfully pre-warmed CDN cache", zap.String("url", urlToWarm))
		}
	}(targetURL)
}

func (c *CDNBuilder) PurgeCache(fullFileURL string) error {
	apiKey := c.cfg.CDN.APIKey
	if apiKey == "" || !c.cfg.CDN.Enabled {
		return nil
	}

	reqURL := fmt.Sprintf("https://api.bunny.net/purge?url=%s", url.QueryEscape(fullFileURL))

	req, err := http.NewRequest("POST", reqURL, nil)
	if err != nil {
		return err
	}
	req.Header.Add("AccessKey", apiKey)

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
