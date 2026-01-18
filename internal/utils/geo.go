package utils

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// GetCountryFromArea queries OpenStreetMap to find the country code for a specific area/city name.
func GetCountryFromArea(areaName string) (string, error) {
	apiURL := "https://nominatim.openstreetmap.org/search"
	u, _ := url.Parse(apiURL)
	q := u.Query()
	q.Set("q", areaName)
	q.Set("format", "json")
	q.Set("addressdetails", "1")
	q.Set("limit", "1")
	u.RawQuery = q.Encode()

	req, _ := http.NewRequest("GET", u.String(), nil)
	// Nominatim REQUIRES a User-Agent
	req.Header.Set("User-Agent", "MomoRadio/1.0")

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var results []struct {
		Address struct {
			CountryCode string `json:"country_code"` // e.g., "au"
		} `json:"address"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&results); err != nil {
		return "", err
	}

	if len(results) > 0 && results[0].Address.CountryCode != "" {
		// Nominatim returns lowercase (au), we want uppercase (AU)
		return strings.ToUpper(results[0].Address.CountryCode), nil
	}

	return "", fmt.Errorf("could not find country for area: %s", areaName)
}
