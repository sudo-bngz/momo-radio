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
	BPM          float64
	MusicalKey   string
	Scale        string
	Danceability float64
	Loudness     float64
	Duration     float64
	Energy       float64 // Added this to store the derived energy value
}

type EssentiaJSON struct {
	LowLevel struct {
		AverageLoudness float64 `json:"average_loudness"`
		SpectralEnergy  struct {
			Mean float64 `json:"mean"`
		} `json:"spectral_energy"`
	} `json:"lowlevel"`
	Rhythm struct {
		BPM          float64 `json:"bpm"`
		Danceability float64 `json:"danceability"`
	} `json:"rhythm"`
	Tonal struct {
		KeyEdma struct {
			Key   string `json:"key"`
			Scale string `json:"scale"`
		} `json:"key_edma"`
	} `json:"tonal"`
	Metadata struct {
		AudioProperties struct {
			Length float64 `json:"length"`
		} `json:"audio_properties"`
	} `json:"metadata"`
}

func AnalyzeDeep(path string) (*DeepAnalysis, error) {
	absPath, _ := filepath.Abs(path)

	// 1. Create a "Safe" temporary WAV file (44.1kHz, Mono)
	safeWav := absPath + ".safe.wav"
	jsonPath := absPath + ".json"

	log.Printf("🧪 Pre-transcoding: %s", filepath.Base(path))

	convCmd := exec.Command("ffmpeg", "-y", "-i", absPath, "-ar", "44100", "-ac", "1", "-f", "wav", safeWav)
	if out, err := convCmd.CombinedOutput(); err != nil {
		log.Printf("❌ Pre-transcode failed: %v | %s", err, string(out))
		return nil, err
	}
	defer os.Remove(safeWav)

	// 2. Run the extractor
	log.Printf("🚀 Running Essentia...")
	cmd := exec.Command("streaming_extractor_music", safeWav, jsonPath)
	out, err := cmd.CombinedOutput()
	if err != nil {
		log.Printf("❌ Essentia failed: %v\nOutput: %s", err, string(out))
		return nil, fmt.Errorf("essentia crash")
	}

	// 3. Read the generated JSON
	data, err := os.ReadFile(jsonPath)
	if err != nil {
		return nil, err
	}
	defer os.Remove(jsonPath)

	var raw EssentiaJSON
	if err := json.Unmarshal(data, &raw); err != nil {
		log.Printf("❌ Failed to parse JSON: %v", err)
		return nil, err
	}

	// 4. Map the new paths
	analysis := &DeepAnalysis{
		BPM:          raw.Rhythm.BPM,
		MusicalKey:   raw.Tonal.KeyEdma.Key,
		Scale:        raw.Tonal.KeyEdma.Scale,
		Danceability: raw.Rhythm.Danceability,
		Loudness:     raw.LowLevel.AverageLoudness,
		Duration:     raw.Metadata.AudioProperties.Length,
		Energy:       raw.LowLevel.SpectralEnergy.Mean,
	}

	log.Printf("✨ Result: %s | %.2f BPM | %s %s",
		filepath.Base(path),
		analysis.BPM,
		analysis.MusicalKey,
		analysis.Scale,
	)

	return analysis, nil
}
