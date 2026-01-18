package metadata

import (
	"encoding/json"
	"fmt"
	"log" // Added log package
	"net/http"
	"net/url"
	"time"
)

// GetArtistCountryViaMusicBrainz queries the MusicBrainz API to find the artist's area/country.
func GetArtistCountryViaMusicBrainz(artistName, contactEmail string) (string, error) {
	if contactEmail == "" {
		contactEmail = "admin@localhost"
	}

	baseURL := "https://musicbrainz.org/ws/2/artist"
	u, _ := url.Parse(baseURL)
	q := u.Query()
	q.Set("query", fmt.Sprintf("artist:\"%s\"", artistName))
	q.Set("fmt", "json")
	q.Set("limit", "1")
	u.RawQuery = q.Encode()

	// 1. Log the attempt
	log.Printf("🛰️  [MusicBrainz] Querying for artist: '%s'...", artistName)

	req, _ := http.NewRequest("GET", u.String(), nil)
	req.Header.Set("User-Agent", fmt.Sprintf("MomoRadioIngester/1.0 ( %s )", contactEmail))

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("❌ [MusicBrainz] HTTP request failed: %v", err)
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		log.Printf("❌ [MusicBrainz] API returned bad status: %d", resp.StatusCode)
		return "", fmt.Errorf("musicbrainz status %d", resp.StatusCode)
	}

	var result struct {
		Artists []struct {
			Name    string `json:"name"`
			Country string `json:"country"` // ISO Code (e.g. "FR")
			Area    struct {
				Name string `json:"name"` // Full Name (e.g. "France")
			} `json:"area"`
			Score int `json:"score"` // Match score (useful to see quality)
		} `json:"artists"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		log.Printf("❌ [MusicBrainz] JSON decode failed: %v", err)
		return "", err
	}

	if len(result.Artists) > 0 {
		match := result.Artists[0]

		// 2. Log what we found
		log.Printf("   -> Match Found: '%s' (Score: %d) | Country: '%s' | Area: '%s'",
			match.Name, match.Score, match.Country, match.Area.Name)

		// Priority: Use the ISO code (Country) if available, otherwise Area name
		if match.Country != "" {
			return match.Country, nil
		}
		if match.Area.Name != "" {
			return match.Area.Name, nil
		}
	}

	// 3. Log if empty
	log.Printf("⚠️ [MusicBrainz] No results found for '%s'", artistName)
	return "", fmt.Errorf("artist not found")
}
