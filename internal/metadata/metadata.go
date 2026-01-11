package metadata

import (
	"encoding/json"
	"fmt"
	"momo-radio/internal/utils"
	"net/http"
	"net/url"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
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

// EnrichViaDiscogs fetches metadata from Discogs (Best for Labels/Publishers)
// It attempts to find the oldest release to identify the original label.
func EnrichViaDiscogs(filename, token string) (Track, error) {
	if token == "" {
		return Track{}, fmt.Errorf("no discogs token provided")
	}

	cleanName := utils.CleanFilename(filename)
	apiURL := "https://api.discogs.com/database/search"

	u, _ := url.Parse(apiURL)
	q := u.Query()
	q.Set("q", cleanName)
	q.Set("type", "release")
	q.Set("token", token)
	q.Set("per_page", "50") // Fetch more items to find the oldest
	u.RawQuery = q.Encode()

	req, _ := http.NewRequest("GET", u.String(), nil)
	// Discogs requires a User-Agent
	req.Header.Set("User-Agent", "MomoRadioIngester/0.2")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return Track{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return Track{}, fmt.Errorf("status %d", resp.StatusCode)
	}

	// Define struct to match API response
	type DiscogsItem struct {
		Title string   `json:"title"` // Format: Artist - Title
		Label []string `json:"label"`
		Year  string   `json:"year"`
		Genre []string `json:"genre"`
		Style []string `json:"style"` // Electronic sub-genres (e.g. Techno, House)
	}

	var result struct {
		Results []DiscogsItem `json:"results"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return Track{}, err
	}

	if len(result.Results) == 0 {
		return Track{}, fmt.Errorf("no results for '%s'", cleanName)
	}

	// Filter and Sort Candidates to find the oldest
	type candidate struct {
		YearVal int
		Item    DiscogsItem
	}

	var candidates []candidate

	for _, res := range result.Results {
		// We need a valid year and at least one label
		if res.Year == "" || len(res.Label) == 0 {
			continue
		}

		// Parse year
		y, err := strconv.Atoi(res.Year)
		if err != nil {
			continue // Skip invalid years
		}

		candidates = append(candidates, candidate{
			YearVal: y,
			Item:    res,
		})
	}

	var bestItem DiscogsItem

	if len(candidates) > 0 {
		// Sort by Year Ascending (Oldest first)
		sort.Slice(candidates, func(i, j int) bool {
			return candidates[i].YearVal < candidates[j].YearVal
		})
		bestItem = candidates[0].Item
	} else {
		// Fallback to the first result if no valid dates found
		bestItem = result.Results[0]
	}

	item := bestItem

	// Parse Artist/Title from Discogs "Artist - Title" format
	artist := ""
	title := ""
	parts := strings.SplitN(item.Title, " - ", 2)
	if len(parts) == 2 {
		artist = parts[0]
		title = parts[1]
	} else {
		title = item.Title // Fallback
	}

	label := ""
	if len(item.Label) > 0 {
		label = item.Label[0]
	}

	genre := ""
	// Prefer Style (Electronic subgenre) over Genre (General)
	if len(item.Style) > 0 {
		genre = item.Style[0]
	} else if len(item.Genre) > 0 {
		genre = item.Genre[0]
	}

	return Track{
		Artist:    artist,
		Title:     title,
		Year:      item.Year,
		Genre:     genre,
		Publisher: label,
	}, nil
}

func CleanQuery(filename string) string {
	// 1. Remove extension
	name := strings.TrimSuffix(filename, filepath.Ext(filename))

	// 2. Split by " - "
	parts := strings.Split(name, " - ")
	if len(parts) < 2 {
		return name // Too simple to clean
	}

	// Usually: [Artist] - [Release/Vol] - [Position] - [Track Title]
	// We want the FIRST part and the LAST part.
	artist := strings.TrimSpace(parts[0])
	title := strings.TrimSpace(parts[len(parts)-1])

	// 3. Clean the Title: Remove parentheticals like "(Original Mix)" or "(Beats Mix)"
	// APIs often work better without these.
	if idx := strings.Index(title, "("); idx != -1 {
		title = strings.TrimSpace(title[:idx])
	}

	// 4. Clean the Title: Remove track positions (e.g., A1, B2, 12 inch mix)
	// This regex looks for patterns like B2 or A1 at the start of the title part
	// but in your case, it's often a separate part of the split.

	return fmt.Sprintf("%s %s", artist, title)
}
