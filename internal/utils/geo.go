package utils

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"go.uber.org/zap"

	"momo-radio/internal/logger"
)

// GetCountryFromArea queries OpenStreetMap to find the country code for a specific area/city name.
func GetCountryFromArea(areaName string) (string, error) {
	if strings.TrimSpace(areaName) == "" {
		return "", fmt.Errorf("area name is empty")
	}

	apiURL := "https://nominatim.openstreetmap.org/search"
	u, _ := url.Parse(apiURL)
	q := u.Query()
	q.Set("q", areaName)
	q.Set("format", "json")
	q.Set("addressdetails", "1")
	q.Set("limit", "1")
	u.RawQuery = q.Encode()

	logger.Log.Debug("Querying OpenStreetMap Nominatim API", zap.String("area", areaName))

	req, _ := http.NewRequest("GET", u.String(), nil)
	// Nominatim REQUIRES a User-Agent
	req.Header.Set("User-Agent", "MomoRadio/1.0")

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		logger.Log.Error("Nominatim API request failed",
			zap.String("area", areaName),
			zap.Error(err),
		)
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		err := fmt.Errorf("nominatim returned status: %d", resp.StatusCode)
		logger.Log.Warn("Nominatim API rejected request",
			zap.String("area", areaName),
			zap.Int("status_code", resp.StatusCode),
			zap.Error(err),
		)
		return "", err
	}

	var results []struct {
		Address struct {
			CountryCode string `json:"country_code"` // e.g., "au"
		} `json:"address"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&results); err != nil {
		logger.Log.Error("Failed to decode Nominatim response", zap.Error(err))
		return "", err
	}

	if len(results) > 0 && results[0].Address.CountryCode != "" {
		// Nominatim returns lowercase (au), we want uppercase (AU)
		countryCode := strings.ToUpper(results[0].Address.CountryCode)
		logger.Log.Debug("Successfully resolved country code",
			zap.String("area", areaName),
			zap.String("country_code", countryCode),
		)
		return countryCode, nil
	}

	logger.Log.Debug("No country mapping found for area", zap.String("area", areaName))
	return "", fmt.Errorf("could not find country for area: %s", areaName)
}
