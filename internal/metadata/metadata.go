package metadata

import (
	"encoding/json"
	"fmt"
	"momo-radio/internal/utils"
	"net/http"
	"net/url"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

type Track struct {
	Artist       string  `json:"artist"`
	Title        string  `json:"title"`
	Genre        string  `json:"genre"`
	Album        string  `json:"album"`
	Year         string  `json:"year"`
	Publisher    string  `json:"publisher"`
	BPM          float64 `json:"bpm"`
	Duration     float64 `json:"duration"`
	MusicalKey   string  `json:"musical_key"`
	Scale        string  `json:"scale"`
	Danceability float64 `json:"danceability"`
	Loudness     float64 `json:"loudness"`
}

// GetLocal reads tags from a file using ffprobe.
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
			// Check standard, uppercase, and lowercase (ID3 vs Vorbis)
			for _, variant := range []string{k, strings.ToUpper(k), strings.ToLower(k)} {
				if val := tags[variant]; val != "" {
					return strings.TrimSpace(val)
				}
			}
		}
		return ""
	}

	return Track{
		Artist:    getTag("artist", "albumartist", "TPE1", "TPE2"),
		Title:     getTag("title", "TIT2"),
		Album:     getTag("album", "TALB"),
		Genre:     getTag("genre", "TCON"),
		Year:      getTag("date", "year", "TYER", "TDRC", "creation_time"),
		Publisher: getTag("publisher", "label", "organization", "TPUB"),
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

func EnrichViaDiscogs(artist, title, token string) (Track, error) {
	if token == "" {
		return Track{}, fmt.Errorf("no discogs token provided")
	}

	apiURL := "https://api.discogs.com/database/search"

	u, _ := url.Parse(apiURL)
	q := u.Query()
	q.Set("artist", artist)
	q.Set("track", title)
	q.Set("type", "release")
	q.Set("token", token)
	q.Set("per_page", "10")
	u.RawQuery = q.Encode()

	req, _ := http.NewRequest("GET", u.String(), nil)
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

	type DiscogsItem struct {
		Title string   `json:"title"`
		Label []string `json:"label"`
		Year  string   `json:"year"`
		Genre []string `json:"genre"`
		Style []string `json:"style"`
	}

	var result struct {
		Results []DiscogsItem `json:"results"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return Track{}, err
	}

	if len(result.Results) == 0 {
		return Track{}, fmt.Errorf("no results for '%s'", artist+" "+title)
	}

	// Logic to pick the best/oldest item
	var bestItem DiscogsItem
	foundOldest := false
	minYear := 9999

	for _, res := range result.Results {
		if res.Year == "" {
			continue
		}
		y, err := strconv.Atoi(res.Year)
		if err == nil && y < minYear {
			minYear = y
			bestItem = res
			foundOldest = true
		}
	}

	if !foundOldest {
		bestItem = result.Results[0]
	}

	item := bestItem

	// --- IMPROVED GENRE/STYLE EXTRACTION ---
	var allTags []string

	// 1. Collect Styles (more specific, e.g., "Minimal", "Deep House")
	for _, s := range item.Style {
		allTags = append(allTags, strings.TrimSpace(s))
	}

	// 2. Collect Genres (broad, e.g., "Electronic"), avoid duplicates
	for _, g := range item.Genre {
		gClean := strings.TrimSpace(g)
		isDup := false
		for _, existing := range allTags {
			if strings.EqualFold(existing, gClean) {
				isDup = true
				break
			}
		}
		if !isDup {
			allTags = append(allTags, gClean)
		}
	}

	// Join with comma and space for the database: "Minimal, Techno, Electronic"
	fullGenreString := strings.Join(allTags, ", ")

	// Parse Artist/Title
	artist, title = "", ""
	parts := strings.SplitN(item.Title, " - ", 2)
	if len(parts) == 2 {
		artist, title = parts[0], parts[1]
	} else {
		title = item.Title
	}

	label := ""
	if len(item.Label) > 0 {
		label = item.Label[0]
	}

	return Track{
		Artist:    artist,
		Title:     title,
		Year:      item.Year,
		Genre:     fullGenreString,
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
