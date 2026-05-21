package metadata

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type ITunesRelease struct {
	ArtistName string
	TrackTitle string
	AlbumName  string
	Genre      string
	Year       string
	CoverURL   string
}

// EnrichViaITunes fetches mainstream fallback data from Apple
func EnrichViaITunes(artist, title string) (*ITunesRelease, error) {
	apiURL := "https://itunes.apple.com/search"

	u, _ := url.Parse(apiURL)
	q := u.Query()
	// Combine artist and title for the most accurate iTunes query
	q.Set("term", fmt.Sprintf("%s %s", artist, title))
	q.Set("media", "music")
	q.Set("entity", "song")
	q.Set("limit", "1")
	u.RawQuery = q.Encode()

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(u.String())
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("itunes status %d", resp.StatusCode)
	}

	var result struct {
		ResultCount int `json:"resultCount"`
		Results     []struct {
			ArtistName       string `json:"artistName"`
			TrackName        string `json:"trackName"`
			CollectionName   string `json:"collectionName"`
			PrimaryGenreName string `json:"primaryGenreName"`
			ReleaseDate      string `json:"releaseDate"`
			ArtworkUrl100    string `json:"artworkUrl100"`
		} `json:"results"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	if result.ResultCount == 0 {
		return nil, fmt.Errorf("no itunes results for '%s - %s'", artist, title)
	}

	item := result.Results[0]
	year := ""
	if len(item.ReleaseDate) >= 4 {
		year = item.ReleaseDate[:4]
	}

	highResCover := strings.Replace(item.ArtworkUrl100, "100x100bb.jpg", "600x600bb.jpg", 1)

	return &ITunesRelease{
		ArtistName: item.ArtistName,
		TrackTitle: item.TrackName,
		AlbumName:  item.CollectionName,
		Genre:      item.PrimaryGenreName,
		Year:       year,
		CoverURL:   highResCover,
	}, nil
}
