package audio

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os/exec"
	"time"

	"go.uber.org/zap"

	"momo-radio/internal/logger"
)

// GetMusicBrainzID generates an audio fingerprint and queries AcoustID for the exact MBID.
func GetMusicBrainzID(filePath string, apiKey string) (string, error) {
	if apiKey == "" {
		// We don't need to log this as an error here, the caller handles the warning gracefully
		return "", fmt.Errorf("acoustid api key is missing")
	}

	logger.Log.Debug("Generating acoustic fingerprint via fpcalc", zap.String("file_path", filePath))

	// 1. Run fpcalc to get the raw acoustic fingerprint
	cmd := exec.Command("fpcalc", "-json", filePath)
	out, err := cmd.Output()
	if err != nil {
		logger.Log.Error("fpcalc failed (is it installed?)",
			zap.String("file_path", filePath),
			zap.Error(err),
		)
		return "", fmt.Errorf("fpcalc failed (is it installed?): %w", err)
	}

	var fpResult struct {
		Duration    float64 `json:"duration"`
		Fingerprint string  `json:"fingerprint"`
	}
	if err := json.Unmarshal(out, &fpResult); err != nil {
		logger.Log.Error("Failed to parse fpcalc output", zap.Error(err))
		return "", fmt.Errorf("failed to parse fpcalc output: %w", err)
	}

	logger.Log.Debug("Querying AcoustID API",
		zap.Float64("duration_seconds", fpResult.Duration),
		zap.Int("fingerprint_length", len(fpResult.Fingerprint)),
	)

	// 2. Query the AcoustID API
	apiURL := "https://api.acoustid.org/v2/lookup"
	u, _ := url.Parse(apiURL)
	q := u.Query()
	q.Set("client", apiKey)
	q.Set("meta", "recordings") // We want the MusicBrainz Recording IDs
	q.Set("duration", fmt.Sprintf("%.0f", fpResult.Duration))
	q.Set("fingerprint", fpResult.Fingerprint)
	u.RawQuery = q.Encode()

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(u.String())
	if err != nil {
		logger.Log.Error("AcoustID API request failed", zap.Error(err))
		return "", fmt.Errorf("acoustid api request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		logger.Log.Warn("AcoustID API returned non-200 status", zap.Int("status_code", resp.StatusCode))
		return "", fmt.Errorf("acoustid returned status: %d", resp.StatusCode)
	}

	var acoustidResp struct {
		Status  string `json:"status"`
		Results []struct {
			Recordings []struct {
				ID string `json:"id"`
			} `json:"recordings"`
		} `json:"results"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&acoustidResp); err != nil {
		logger.Log.Error("Failed to decode AcoustID response", zap.Error(err))
		return "", fmt.Errorf("failed to decode acoustid response: %w", err)
	}

	if acoustidResp.Status != "ok" || len(acoustidResp.Results) == 0 || len(acoustidResp.Results[0].Recordings) == 0 {
		logger.Log.Debug("No acoustic match found in database")
		return "", fmt.Errorf("no acoustic match found in database")
	}

	// 3. Return the deterministic MusicBrainz ID
	mbid := acoustidResp.Results[0].Recordings[0].ID
	logger.Log.Debug("Acoustic match successfully resolved", zap.String("mbid", mbid))

	return mbid, nil
}
