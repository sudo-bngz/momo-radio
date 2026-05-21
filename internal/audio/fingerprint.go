package audio

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os/exec"
	"time"
)

// GetMusicBrainzID generates an audio fingerprint and queries AcoustID for the exact MBID.
func GetMusicBrainzID(filePath string, apiKey string) (string, error) {
	if apiKey == "" {
		return "", fmt.Errorf("acoustid api key is missing")
	}

	// 1. Run fpcalc to get the raw acoustic fingerprint
	cmd := exec.Command("fpcalc", "-json", filePath)
	out, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("fpcalc failed (is it installed?): %w", err)
	}

	var fpResult struct {
		Duration    float64 `json:"duration"`
		Fingerprint string  `json:"fingerprint"`
	}
	if err := json.Unmarshal(out, &fpResult); err != nil {
		return "", fmt.Errorf("failed to parse fpcalc output: %w", err)
	}

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
		return "", fmt.Errorf("acoustid api request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
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
		return "", fmt.Errorf("failed to decode acoustid response: %w", err)
	}

	if acoustidResp.Status != "ok" || len(acoustidResp.Results) == 0 || len(acoustidResp.Results[0].Recordings) == 0 {
		return "", fmt.Errorf("no acoustic match found in database")
	}

	// 3. Return the deterministic MusicBrainz ID
	return acoustidResp.Results[0].Recordings[0].ID, nil
}
