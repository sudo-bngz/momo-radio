package metadata

import (
	"encoding/json"
	"fmt"
	"momo-radio/internal/utils"
	"net/http"
	"net/url"
	"os/exec"
	"strings"
	"time"
)

type Track struct {
	Artist    string `json:"artist"`
	Title     string `json:"title"`
	Genre     string `json:"genre"`
	Album     string `json:"album"`
	Year      string `json:"year"`
	Publisher string `json:"publisher"`
}

// GetLocal reads tags from a file using ffprobe
func GetLocal(path string) (Track, error) {
	cmd := exec.Command("ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", path)
	out, err := cmd.Output()
	if err != nil {
		return Track{}, err
	}

	var data struct {
		Format struct {
			Tags map[string]string `json:"tags"`
		} `json:"format"`
	}
	if err := json.Unmarshal(out, &data); err != nil {
		return Track{}, err
	}

	tags := data.Format.Tags
	getTag := func(keys ...string) string {
		for _, k := range keys {
			if val := tags[k]; val != "" {
				return val
			}
			if val := tags[strings.ToUpper(k)]; val != "" {
				return val
			}
		}
		return ""
	}

	return Track{
		Artist:    getTag("artist", "album_artist"),
		Title:     getTag("title"),
		Album:     getTag("album"),
		Genre:     getTag("genre"),
		Year:      getTag("date", "year", "TYER", "creation_time"),
		Publisher: getTag("publisher", "organization", "copyright", "label"),
	}, nil
}

// EnrichViaITunes fetches metadata if local tags are missing
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
