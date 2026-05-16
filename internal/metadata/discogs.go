package metadata

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"momo-radio/internal/utils"
)

func EnrichViaDiscogs(artist, title, token string, email string) (Track, error) {
	if token == "" {
		return Track{}, fmt.Errorf("no discogs token provided")
	}

	client := &http.Client{Timeout: 10 * time.Second}

	// --- STEP 1: SEARCH ---
	searchURL := "https://api.discogs.com/database/search"
	u, _ := url.Parse(searchURL)
	q := u.Query()
	q.Set("q", fmt.Sprintf("%s %s", artist, title))
	q.Set("type", "release")
	q.Set("token", token)
	u.RawQuery = q.Encode()

	req, _ := http.NewRequest("GET", u.String(), nil)
	req.Header.Set("User-Agent", "MomoRadioIngester/0.2")

	resp, err := client.Do(req)
	if err != nil {
		return Track{}, err
	}
	defer resp.Body.Close()

	var searchResult struct {
		Results []struct {
			ResourceURL string `json:"resource_url"`
		} `json:"results"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&searchResult); err != nil {
		return Track{}, err
	}

	if len(searchResult.Results) == 0 {
		return Track{}, fmt.Errorf("no results found")
	}

	// --- STEP 2: FETCH DETAILS ---
	detailsURL := searchResult.Results[0].ResourceURL
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

	// Struct for the detailed release data
	var release struct {
		Title   string   `json:"title"`
		Year    any      `json:"year"`
		Country string   `json:"country"`
		Styles  []string `json:"styles"`
		Genres  []string `json:"genres"`
		Labels  []struct {
			Name  string `json:"name"`
			Catno string `json:"catno"`
		} `json:"labels"`
		Artists []struct {
			Name string `json:"name"`
		} `json:"artists"`
		Images []struct {
			ResourceURL string `json:"resource_url"`
			Type        string `json:"type"`
		} `json:"images"`
	}

	if err := json.NewDecoder(respDetails.Body).Decode(&release); err != nil {
		return Track{}, err
	}

	bestCoverURL := ""
	if len(release.Images) > 0 {
		bestCoverURL = release.Images[0].ResourceURL
		for _, img := range release.Images {
			if img.Type == "primary" {
				bestCoverURL = img.ResourceURL
				break
			}
		}
	}

	var yearStr string
	switch v := release.Year.(type) {
	case float64:
		yearStr = fmt.Sprintf("%.0f", v)
	case string:
		yearStr = v
	}

	var finalArtists []string
	if len(release.Artists) > 0 {
		for _, a := range release.Artists {
			name := a.Name
			// Discogs often appends " (1)" to artist names to resolve duplicates. We strip it.
			if idx := strings.Index(name, " ("); idx != -1 {
				name = name[:idx]
			}
			name = strings.TrimSpace(name)
			if name != "" {
				finalArtists = append(finalArtists, name)
			}
		}
	}

	// Fallback to our Regex split if Discogs didn't return artist data
	if len(finalArtists) == 0 {
		finalArtists = utils.SplitArtistFallback(artist)
	}

	publisher := ""
	catNo := ""
	if len(release.Labels) > 0 {
		publisher = release.Labels[0].Name
		catNo = release.Labels[0].Catno
	}

	genre := ""
	if len(release.Genres) > 0 {
		genre = release.Genres[0]
	}

	return Track{
		Artists:       finalArtists, // ⚡️ Now maps to the array!
		Title:         release.Title,
		Year:          yearStr,
		Genre:         genre,
		Style:         strings.Join(release.Styles, ", "),
		Publisher:     publisher,
		Country:       release.Country,
		CatalogNumber: strings.ToUpper(catNo),
		CoverURL:      bestCoverURL,
	}, nil
}

// GetArtistCountryViaDiscogs tries to infer an artist's country from their Discogs profile/releases.
func GetArtistCountryViaDiscogs(artistName, token string) (string, error) {
	// 1. Search for the Artist to get their ID
	searchURL := "https://api.discogs.com/database/search"
	u, _ := url.Parse(searchURL)
	q := u.Query()
	q.Set("q", artistName)
	q.Set("type", "artist")
	q.Set("token", token)
	u.RawQuery = q.Encode()

	req, _ := http.NewRequest("GET", u.String(), nil)
	req.Header.Set("User-Agent", "MomoRadio/1.0")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil || resp.StatusCode != 200 {
		return "", fmt.Errorf("discogs search failed")
	}
	defer resp.Body.Close()

	var searchResult struct {
		Results []struct {
			ID int `json:"id"`
		} `json:"results"`
	}
	json.NewDecoder(resp.Body).Decode(&searchResult)

	if len(searchResult.Results) == 0 {
		return "", fmt.Errorf("artist not found on discogs")
	}

	artistID := searchResult.Results[0].ID

	// 2. Fetch Artist's Releases to find the dominant country
	// Discogs "Release" objects have a 'country' field.
	// Most artists release primarily in their home market or 'Europe/US'.
	releaseURL := fmt.Sprintf("https://api.discogs.com/artists/%d/releases", artistID)
	req, _ = http.NewRequest("GET", releaseURL+"?sort=year&sort_order=asc&token="+token, nil)
	req.Header.Set("User-Agent", "MomoRadio/1.0")

	resp, err = client.Do(req)
	if err != nil || resp.StatusCode != 200 {
		return "", fmt.Errorf("could not fetch artist releases")
	}
	defer resp.Body.Close()

	var relResult struct {
		Releases []struct {
			Status  string `json:"status"`
			Country string `json:"country"`
		} `json:"releases"`
	}
	json.NewDecoder(resp.Body).Decode(&relResult)

	// Tally countries to find the most common one (excluding 'Worldwide' or 'Europe' if possible)
	counts := make(map[string]int)
	for _, r := range relResult.Releases {
		counts[r.Country]++
	}

	bestCountry := ""
	maxCount := 0
	for c, count := range counts {
		if count > maxCount {
			maxCount = count
			bestCountry = c
		}
	}

	if bestCountry == "" {
		return "", fmt.Errorf("no specific country found in releases")
	}

	return bestCountry, nil
}

func DownloadImage(imageUrl, token string) ([]byte, error) {
	if imageUrl == "" {
		return nil, fmt.Errorf("empty url")
	}

	client := &http.Client{Timeout: 15 * time.Second}

	if !strings.Contains(imageUrl, "token=") {
		separator := "?"
		if strings.Contains(imageUrl, "?") {
			separator = "&"
		}
		imageUrl += separator + "token=" + token
	}

	req, _ := http.NewRequest("GET", imageUrl, nil)
	req.Header.Set("User-Agent", "MomoRadioIngester/0.2")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	return io.ReadAll(resp.Body)
}
