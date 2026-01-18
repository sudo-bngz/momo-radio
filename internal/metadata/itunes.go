package metadata

import (
	"encoding/json"
	"fmt"
	"momo-radio/internal/utils"
	"net/http"
	"net/url"
	"time"
)

// EnrichViaITunes fetches metadata from iTunes (Good for Artist/Title/Year)
func EnrichViaITunes(filename string) (Track, error) {
	cleanName := utils.CleanFilename(filename)
	apiURL := "https://itunes.apple.com/search"

	u, _ := url.Parse(apiURL)
	q := u.Query()
	q.Set("term", cleanName)
	q.Set("media", "music")
	q.Set("entity", "song")
	q.Set("limit", "1")
	u.RawQuery = q.Encode()

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(u.String())
	if err != nil {
		return Track{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return Track{}, fmt.Errorf("status %d", resp.StatusCode)
	}

	var result struct {
		ResultCount int `json:"resultCount"`
		Results     []struct {
			ArtistName       string `json:"artistName"`
			TrackName        string `json:"trackName"`
			CollectionName   string `json:"collectionName"`
			PrimaryGenreName string `json:"primaryGenreName"`
			ReleaseDate      string `json:"releaseDate"`
		} `json:"results"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return Track{}, err
	}

	if result.ResultCount == 0 {
		return Track{}, fmt.Errorf("no results for '%s'", cleanName)
	}

	item := result.Results[0]
	year := ""
	if len(item.ReleaseDate) >= 4 {
		year = item.ReleaseDate[:4]
	}

	return Track{
		Artist: item.ArtistName,
		Title:  item.TrackName,
		Album:  item.CollectionName,
		Genre:  item.PrimaryGenreName,
		Year:   year,
	}, nil
}
