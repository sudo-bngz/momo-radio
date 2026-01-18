package metadata

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

func EnrichViaDiscogs(artist, title, token string, email string) (Track, error) {
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
	// Ideally, keep original input 'artist' unless it was empty/unknown.
	finalArtist := artist
	if len(release.Artists) > 0 {
		// Simple heuristic: if input was vague, take the specific one
		// Otherwise, stick to to filename parsing to avoid "[a=Name]" garbage.
		// For now trust the release data but strip potential suffixes like " (2)"
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

	// Fetch the artist country, Discogs provide only the release country
	finalCountry, mbErr := GetArtistCountryViaMusicBrainz(finalArtist, email)
	if mbErr != nil || finalCountry == "" {
		finalCountry = release.Country
	}
	if finalCountry == "" {
		finalCountry = "Unknown"
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
