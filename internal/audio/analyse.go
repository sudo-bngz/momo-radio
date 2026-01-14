package audio

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
)

type DeepAnalysis struct {
	BPM           float64
	MusicalKey    string
	Scale         string
	Danceability  float64
	Loudness      float64
	CatalogNumber string
	Duration      float64
}

type EssentiaJSON struct {
	Metadata struct {
		AudioProperties struct {
			Length float64 `json:"length"`
		} `json:"audio_properties"`
		Tags struct {
			CatalogNumber []string `json:"catalognumber"`
		} `json:"tags"`
	} `json:"metadata"`
	LowLevel struct {
		AverageLoudness float64 `json:"average_loudness"`
	} `json:"lowlevel"`
	Rhythm struct {
		BPM          float64 `json:"bpm"`
		Danceability float64 `json:"danceability"`
	} `json:"rhythm"`
	Tonal struct {
		KeyKey   string `json:"key_key"`
		KeyScale string `json:"key_scale"`
	} `json:"tonal"`
}

func AnalyzeDeep(path string) (*DeepAnalysis, error) {
	// Use Absolute Path to prevent binary path resolution errors
	absPath, _ := filepath.Abs(path)
	jsonPath := absPath + ".json"

	log.Printf("🧪 Starting Essentia analysis on: %s", absPath)

	// 1. Check if file exists and is readable
	if info, err := os.Stat(absPath); err != nil || info.Size() == 0 {
		log.Printf("❌ Audio file unreachable or empty: %s", absPath)
		return nil, fmt.Errorf("file error: %v", err)
	}

	// 2. Run the extractor
	cmd := exec.Command("streaming_extractor_music", absPath, jsonPath)
	out, err := cmd.CombinedOutput()
	if err != nil {
		// Log the FULL output. If it's a library error, it will show up here.
		log.Printf("❌ Essentia binary failed: %v", err)
		log.Printf("📝 Binary Output: %s", string(out))
		return nil, fmt.Errorf("essentia execution failed")
	}

	// 3. Read the generated JSON
	data, err := os.ReadFile(jsonPath)
	if err != nil {
		log.Printf("❌ Failed to read generated JSON %s: %v", jsonPath, err)
		return nil, err
	}
	defer os.Remove(jsonPath)

	var raw EssentiaJSON
	if err := json.Unmarshal(data, &raw); err != nil {
		log.Printf("❌ Failed to parse JSON: %v", err)
		return nil, err
	}

	analysis := &DeepAnalysis{
		BPM:          raw.Rhythm.BPM,
		MusicalKey:   raw.Tonal.KeyKey,
		Scale:        raw.Tonal.KeyScale,
		Danceability: raw.Rhythm.Danceability,
		Loudness:     raw.LowLevel.AverageLoudness,
		Duration:     raw.Metadata.AudioProperties.Length,
	}

	if len(raw.Metadata.Tags.CatalogNumber) > 0 {
		analysis.CatalogNumber = raw.Metadata.Tags.CatalogNumber[0]
	}

	log.Printf("✨ Analysis complete for %s (%.2f BPM)", filepath.Base(path), analysis.BPM)
	return analysis, nil
}
