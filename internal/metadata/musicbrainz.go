package metadata

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// MusicBrainzRelease holds the absolute truth for a track
type MusicBrainzRelease struct {
	ArtistName  string
	TrackTitle  string
	ReleaseName string
	Year        string
}

// FetchFromMusicBrainz queries the MB database using the deterministic Acoustic ID
func FetchFromMusicBrainz(mbid string, contactEmail string) (*MusicBrainzRelease, error) {
	if mbid == "" {
		return nil, fmt.Errorf("empty musicbrainz id")
	}

	// Request the recording, including the artists and the releases (albums) it appears on
	url := fmt.Sprintf("https://musicbrainz.org/ws/2/recording/%s?inc=artists+releases&fmt=json", mbid)

	req, _ := http.NewRequest("GET", url, nil)

	// MusicBrainz requires a descriptive User-Agent or they will ban your IP
	userAgent := fmt.Sprintf("MomoRadioIngester/1.0 ( %s )", contactEmail)
	req.Header.Set("User-Agent", userAgent)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("musicbrainz request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("musicbrainz returned status: %d", resp.StatusCode)
	}

	var mbResp struct {
		Title        string `json:"title"`
		ArtistCredit []struct {
			Name string `json:"name"`
		} `json:"artist-credit"`
		Releases []struct {
			Title string `json:"title"`
			Date  string `json:"date"`
		} `json:"releases"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&mbResp); err != nil {
		return nil, fmt.Errorf("failed to decode musicbrainz response: %w", err)
	}

	result := &MusicBrainzRelease{
		TrackTitle: mbResp.Title,
	}

	// Extract primary artist
	if len(mbResp.ArtistCredit) > 0 {
		result.ArtistName = mbResp.ArtistCredit[0].Name
	}

	// Extract the oldest release (usually the original EP/Album, not a later compilation)
	if len(mbResp.Releases) > 0 {
		result.ReleaseName = mbResp.Releases[0].Title
		// Dates usually come as YYYY-MM-DD or YYYY. We just want the year.
		dateStr := mbResp.Releases[0].Date
		if len(dateStr) >= 4 {
			result.Year = dateStr[:4]
		}
	}

	return result, nil
}
