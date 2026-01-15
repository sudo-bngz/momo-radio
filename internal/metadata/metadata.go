package metadata

import (
	"encoding/json"
	"fmt"
	"momo-radio/internal/utils"
	"net/http"
	"net/url"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

type Track struct {
	Artist        string  `json:"artist"`
	Title         string  `json:"title"`
	Genre         string  `json:"genre"`
	Style         string  `json:"style"`
	Album         string  `json:"album"`
	Year          string  `json:"year"`
	Country       string  `json:"country"`
	Publisher     string  `json:"publisher"`
	BPM           float64 `json:"bpm"`
	Duration      float64 `json:"duration"`
	MusicalKey    string  `json:"musical_key"`
	Scale         string  `json:"scale"`
	Danceability  float64 `json:"danceability"`
	Loudness      float64 `json:"loudness"`
	CatalogNumber string  `json:"catalog_number"`
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

	client := &http.Client{Timeout: 10 * time.Second}

	// --- STEP 1: SEARCH ---
	// Find the specific Release ID
	searchURL := "https://api.discogs.com/database/search"
	u, _ := url.Parse(searchURL)
	q := u.Query()
	q.Set("q", fmt.Sprintf("%s %s", artist, title))
	q.Set("type", "release") // Target specific releases, not masters
	q.Set("token", token)
	u.RawQuery = q.Encode()

	req, _ := http.NewRequest("GET", u.String(), nil)
	req.Header.Set("User-Agent", "MomoRadioIngester/0.2")

	resp, err := client.Do(req)
	if err != nil {
		return Track{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return Track{}, fmt.Errorf("discogs search status %d", resp.StatusCode)
	}

	// Minimal struct to extract the Resource URL for the next step
	var searchResult struct {
		Results []struct {
			ResourceURL string `json:"resource_url"`
		} `json:"results"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&searchResult); err != nil {
		return Track{}, err
	}

	if len(searchResult.Results) == 0 {
		return Track{}, fmt.Errorf("no results found for '%s - %s'", artist, title)
	}

	// --- STEP 2: FETCH DETAILS ---
	// Use the Resource URL to get the full metadata (Catalog Number, Country, etc.)
	detailsURL := searchResult.Results[0].ResourceURL

	// Append token correctly depending on existing query params
	if strings.Contains(detailsURL, "?") {
		detailsURL += "&token=" + token
	} else {
		detailsURL += "?token=" + token
	}

	reqDetails, _ := http.NewRequest("GET", detailsURL, nil)
	reqDetails.Header.Set("User-Agent", "MomoRadioIngester/0.2")

	respDetails, err := client.Do(reqDetails)
	if err != nil {
		return Track{}, err
	}
	defer respDetails.Body.Close()

	if respDetails.StatusCode != 200 {
		return Track{}, fmt.Errorf("discogs details status %d", respDetails.StatusCode)
	}

	// Struct for the detailed release data
	var release struct {
		Title   string      `json:"title"`
		Year    interface{} `json:"year"`
		Country string      `json:"country"`
		Styles  []string    `json:"styles"`
		Genres  []string    `json:"genres"`
		Labels  []struct {
			Name  string `json:"name"`
			Catno string `json:"catno"`
		} `json:"labels"`
		Artists []struct {
			Name string `json:"name"`
		} `json:"artists"`
	}

	if err := json.NewDecoder(respDetails.Body).Decode(&release); err != nil {
		return Track{}, err
	}

	var yearStr string
	switch v := release.Year.(type) {
	case float64:
		yearStr = fmt.Sprintf("%.0f", v) // Convert number 1999 to "1999"
	case string:
		yearStr = v
	default:
		yearStr = ""
	}

	// --- MAPPING LOGIC ---

	// 1. Artist Cleaning: Sometimes Discogs returns "Artist (2)", we want just "Artist"
	// Ideally, we keep your original input 'artist' unless it was empty/unknown.
	finalArtist := artist
	if len(release.Artists) > 0 {
		// Simple heuristic: if input was vague, take the specific one
		// Otherwise, stick to your filename parsing to avoid "[a=Name]" garbage.
		// For now, we trust the release data but strip potential suffixes like " (2)"
		name := release.Artists[0].Name
		if idx := strings.Index(name, " ("); idx != -1 {
			name = name[:idx]
		}
		finalArtist = name
	}

	// 2. Publisher & Catalog Number
	publisher := ""
	catNo := ""
	if len(release.Labels) > 0 {
		publisher = release.Labels[0].Name
		catNo = release.Labels[0].Catno
	}

	// 3. Country Fallback
	country := release.Country
	if country == "" {
		country = "Unknown"
	}

	// 4. Join Lists
	genreStr := release.Genres[0]
	styleStr := strings.Join(release.Styles, ", ")

	return Track{
		Artist:        finalArtist,
		Title:         release.Title,
		Year:          yearStr,
		Genre:         genreStr, // Broad: "Electronic"
		Style:         styleStr, // Specific: "Deep House, Minimal"
		Publisher:     publisher,
		Country:       country,
		CatalogNumber: strings.ToUpper(catNo),
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
