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
	absPath, _ := filepath.Abs(path)

	// 1. Create a "Safe" temporary WAV file (44.1kHz, Mono)
	// This uses system's FFmpeg to do the heavy lifting
	safeWav := absPath + ".safe.wav"
	jsonPath := absPath + ".json"

	log.Printf("🧪 Pre-transcoding to Safe WAV for analysis: %s", filepath.Base(path))

	// Convert to 44100Hz, Mono, 16-bit PCM (the 'gold standard' for Essentia)
	convCmd := exec.Command("ffmpeg", "-y", "-i", absPath, "-ar", "44100", "-ac", "1", "-f", "wav", safeWav)
	if out, err := convCmd.CombinedOutput(); err != nil {
		log.Printf("❌ Pre-transcode failed: %v | %s", err, string(out))
		return nil, err
	}
	defer os.Remove(safeWav) // Clean up the big WAV file after

	// 2. Run the extractor on the SAFE WAV
	log.Printf("🚀 Running Essentia on safe WAV...")
	cmd := exec.Command("streaming_extractor_music", safeWav, jsonPath)
	out, err := cmd.CombinedOutput()
	if err != nil {
		log.Printf("❌ Essentia failed even on WAV: %v\nOutput: %s", err, string(out))
		return nil, fmt.Errorf("essentia crash")
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
