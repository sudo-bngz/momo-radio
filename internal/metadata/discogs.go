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

// ============================================================================
// DATA STRUCTURES
// ============================================================================

type DiscogsArtistResult struct {
	ID       string
	Name     string
	Profile  string
	ImageURL string
	Country  string
}

// ============================================================================
// ARTIST ENRICHMENT
// ============================================================================

// FetchArtistFromDiscogs orchestrates finding an artist, grabbing their bio/images,
// and inferring their country using your release-tally method.
func FetchArtistFromDiscogs(artistName, token string) (*DiscogsArtistResult, error) {
	if token == "" {
		return nil, fmt.Errorf("no discogs token provided")
	}

	client := &http.Client{Timeout: 10 * time.Second}

	// --- STEP 1: SEARCH FOR ARTIST ---
	searchURL := "https://api.discogs.com/database/search"
	u, _ := url.Parse(searchURL)
	q := u.Query()
	q.Set("q", artistName)
	q.Set("type", "artist")
	q.Set("token", token)
	u.RawQuery = q.Encode()

	req, _ := http.NewRequest("GET", u.String(), nil)
	req.Header.Set("User-Agent", "MomoRadioIngester/0.2")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == 429 {
		return nil, fmt.Errorf("RATE_LIMIT_EXCEEDED")
	}
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("discogs search returned status %d", resp.StatusCode)
	}

	var searchResult struct {
		Results []struct {
			ID    int    `json:"id"`
			Title string `json:"title"`
		} `json:"results"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&searchResult); err != nil {
		return nil, err
	}

	if len(searchResult.Results) == 0 {
		return nil, fmt.Errorf("no artist found matching: %s", artistName)
	}

	artistID := searchResult.Results[0].ID

	// --- STEP 2: FETCH FULL PROFILE ---
	artistURL := fmt.Sprintf("https://api.discogs.com/artists/%d?token=%s", artistID, token)
	reqArtist, _ := http.NewRequest("GET", artistURL, nil)
	reqArtist.Header.Set("User-Agent", "MomoRadioIngester/0.2")

	respArtist, err := client.Do(reqArtist)
	if err != nil {
		return nil, err
	}
	defer respArtist.Body.Close()

	if respArtist.StatusCode == 429 {
		return nil, fmt.Errorf("RATE_LIMIT_EXCEEDED")
	}

	var artistResp struct {
		ID      int    `json:"id"`
		Name    string `json:"name"`
		Profile string `json:"profile"`
		Images  []struct {
			ResourceURL string `json:"resource_url"`
			Type        string `json:"type"`
		} `json:"images"`
	}
	if err := json.NewDecoder(respArtist.Body).Decode(&artistResp); err != nil {
		return nil, err
	}

	result := &DiscogsArtistResult{
		ID:      fmt.Sprintf("%d", artistResp.ID),
		Name:    artistResp.Name,
		Profile: artistResp.Profile,
	}

	for _, img := range artistResp.Images {
		if img.Type == "primary" {
			result.ImageURL = img.ResourceURL
			break
		}
	}
	if result.ImageURL == "" && len(artistResp.Images) > 0 {
		result.ImageURL = artistResp.Images[0].ResourceURL
	}

	// --- STEP 3: INFER COUNTRY ---
	// Using your existing clever tally logic! We ignore the error so it doesn't fail the whole job if country is missing.
	if country, err := GetArtistCountryViaDiscogs(artistName, token); err == nil {
		result.Country = country
	}

	return result, nil
}

// ============================================================================
// TRACK & RELEASE ENRICHMENT
// ============================================================================
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

	if resp.StatusCode == 429 {
		return Track{}, fmt.Errorf("RATE_LIMIT_EXCEEDED")
	}

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

	if respDetails.StatusCode == 429 {
		return Track{}, fmt.Errorf("RATE_LIMIT_EXCEEDED")
	}

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
			if idx := strings.Index(name, " ("); idx != -1 {
				name = name[:idx]
			}
			name = strings.TrimSpace(name)

			// ⚡️ ANTI-VARIOUS PROTECTION
			// Prevent generic compilation artists from destroying local metadata
			if name != "" && strings.ToLower(name) != "various" && strings.ToLower(name) != "various artists" {
				finalArtists = append(finalArtists, name)
			}
		}
	}

	// ⚡️ Fallback to the original local artist if Discogs ruined it
	if len(finalArtists) == 0 {
		finalArtists = utils.SplitArtistFallback(artist)
	}

	publisher := ""
	catNo := ""
	if len(release.Labels) > 0 {
		publisher = release.Labels[0].Name
		catNo = release.Labels[0].Catno
	}

	// Limit Genres to 2, Styles to 5
	var safeGenres []string
	for i, g := range release.Genres {
		if i >= 2 {
			break
		}
		safeGenres = append(safeGenres, g)
	}

	var safeStyles []string
	for i, s := range release.Styles {
		if i >= 5 {
			break
		}
		safeStyles = append(safeStyles, s)
	}

	return Track{
		Artists:       finalArtists,
		Title:         title, // ⚡️ KEEP ORIGINAL TRACK TITLE (Discogs release.Title is the Album Name!)
		Year:          yearStr,
		Genre:         strings.Join(safeGenres, ", "),
		Style:         strings.Join(safeStyles, ", "),
		Publisher:     publisher,
		Country:       release.Country,
		CatalogNumber: strings.ToUpper(catNo),
		CoverURL:      bestCoverURL,
	}, nil
}

// GetArtistCountryViaDiscogs tries to infer an artist's country from their Discogs profile/releases.
func GetArtistCountryViaDiscogs(artistName, token string) (string, error) {
	searchURL := "https://api.discogs.com/database/search"
	u, _ := url.Parse(searchURL)
	q := u.Query()
	q.Set("q", artistName)
	q.Set("type", "artist")
	q.Set("token", token)
	u.RawQuery = q.Encode()

	req, _ := http.NewRequest("GET", u.String(), nil)
	req.Header.Set("User-Agent", "MomoRadioIngester/0.2")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("discogs search failed")
	}
	defer resp.Body.Close()

	if resp.StatusCode == 429 {
		return "", fmt.Errorf("RATE_LIMIT_EXCEEDED")
	}

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

	releaseURL := fmt.Sprintf("https://api.discogs.com/artists/%d/releases", artistID)
	req, _ = http.NewRequest("GET", releaseURL+"?sort=year&sort_order=asc&token="+token, nil)
	req.Header.Set("User-Agent", "MomoRadioIngester/0.2")

	resp, err = client.Do(req)
	if err != nil {
		return "", fmt.Errorf("could not fetch artist releases")
	}
	defer resp.Body.Close()

	if resp.StatusCode == 429 {
		return "", fmt.Errorf("RATE_LIMIT_EXCEEDED")
	}

	var relResult struct {
		Releases []struct {
			Status  string `json:"status"`
			Country string `json:"country"`
		} `json:"releases"`
	}
	json.NewDecoder(resp.Body).Decode(&relResult)

	counts := make(map[string]int)
	for _, r := range relResult.Releases {
		if r.Country != "" && r.Country != "Unknown" && r.Country != "Worldwide" {
			counts[r.Country]++
		}
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

	if resp.StatusCode == 429 {
		return nil, fmt.Errorf("RATE_LIMIT_EXCEEDED")
	}

	return io.ReadAll(resp.Body)
}
