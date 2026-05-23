package audio

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

type DeepAnalysis struct {
	BPM               float64
	MusicalKey        string
	Scale             string
	Danceability      float64
	Loudness          float64
	Duration          float64
	Energy            float64
	MLMoods           []string
	MLGenres          []string
	MLCharacteristics []string
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
	HighLevel map[string]struct {
		Value string `json:"value"`
	} `json:"highlevel"` // Dynamically catches all AI model outputs
}

// ⚡️ Define the three routing categories
const (
	CatMood           = "mood"
	CatGenre          = "genre"
	CatCharacteristic = "characteristic"
)

type MLTag struct {
	Category string
	Values   []string
}

// ⚡️ THE SMART ROUTER
var MLTagTranslations = map[string]MLTag{
	// MIREX Emotion Clusters -> Moods
	"Cluster1": {CatMood, []string{"Driving", "Confident"}},
	"Cluster2": {CatMood, []string{"Uplifting", "Cheerful"}},
	"Cluster3": {CatMood, []string{"Deep", "Melancholic"}},
	"Cluster4": {CatMood, []string{"Quirky", "Bouncy"}},
	"Cluster5": {CatMood, []string{"Aggressive", "Tense"}},

	// Direct Moods
	"aggressive": {CatMood, []string{"Aggressive"}},
	"relaxed":    {CatMood, []string{"Relaxed", "Chill"}},
	"sad":        {CatMood, []string{"Sad", "Melancholic"}},
	"happy":      {CatMood, []string{"Happy", "Uplifting"}},
	"party":      {CatMood, []string{"Party", "Energetic"}},
	"dark":       {CatMood, []string{"Dark"}},

	// Genres
	"techno":     {CatGenre, []string{"Techno"}},
	"house":      {CatGenre, []string{"House"}},
	"ambient":    {CatGenre, []string{"Ambient"}},
	"dnb":        {CatGenre, []string{"Drum & Bass"}},
	"hip":        {CatGenre, []string{"Hip-Hop", "Breakbeat"}},
	"jaz":        {CatGenre, []string{"Jazz Influenced"}},
	"cla":        {CatGenre, []string{"Classical"}},
	"rnb":        {CatGenre, []string{"R&B Influenced"}},
	"electronic": {CatGenre, []string{"Electronic"}},

	// Characteristics & Rhythms
	"VienneseWaltz": {CatCharacteristic, []string{"Heavy Triplet", "Swing"}},
	"Waltz":         {CatCharacteristic, []string{"Triplet Groove"}},
	"ChaChaCha":     {CatCharacteristic, []string{"Latin", "Syncopated"}},
	"Tango":         {CatCharacteristic, []string{"Dramatic", "Staccato"}},
	"Samba":         {CatCharacteristic, []string{"Upbeat", "Tribal"}},
	"Rumba":         {CatCharacteristic, []string{"Steady", "Groovy"}},
	"Jive":          {CatCharacteristic, []string{"Fast Swing"}},
	"Quickstep":     {CatCharacteristic, []string{"Energetic", "Fast"}},

	"dan":          {CatCharacteristic, []string{"Danceable"}},
	"danceable":    {CatCharacteristic, []string{"Danceable"}},
	"atonal":       {CatCharacteristic, []string{"Atonal", "Experimental"}},
	"tonal":        {CatCharacteristic, []string{"Tonal", "Melodic"}},
	"instrumental": {CatCharacteristic, []string{"Instrumental"}},
	"voice":        {CatCharacteristic, []string{"Vocal"}},
	"female":       {CatCharacteristic, []string{"Female Vocal"}},
	"male":         {CatCharacteristic, []string{"Male Vocal"}},
}

// Struct to hold the cleanly sorted output
type CategorizedTags struct {
	Moods           []string
	Genres          []string
	Characteristics []string
}

// TranslateAndSortTags processes raw AI tags, flattens them, and sorts them by column
func TranslateAndSortTags(rawTags []string) CategorizedTags {
	var result CategorizedTags
	seen := make(map[string]bool)

	for _, tag := range rawTags {
		mapping, exists := MLTagTranslations[tag]

		// Fallback: If it's an unknown tag, default it to Characteristics
		if !exists {
			cleanFallback := strings.Title(strings.ToLower(tag))
			if !seen[cleanFallback] {
				result.Characteristics = append(result.Characteristics, cleanFallback)
				seen[cleanFallback] = true
			}
			continue
		}

		// Route the translated strings into the correct bucket
		for _, translatedTag := range mapping.Values {
			if !seen[translatedTag] {
				switch mapping.Category {
				case CatMood:
					result.Moods = append(result.Moods, translatedTag)
				case CatGenre:
					result.Genres = append(result.Genres, translatedTag)
				case CatCharacteristic:
					result.Characteristics = append(result.Characteristics, translatedTag)
				}
				seen[translatedTag] = true
			}
		}
	}
	return result
}

// autoGenerateProfile scans the Docker folder and generates the YAML array for Essentia
func autoGenerateProfile() (string, error) {
	modelsDir := "/opt/essentia_models/essentia-extractor-svm_models-v2.1_beta5"
	profilePath := filepath.Join(modelsDir, "profile.yaml")

	// Fast path: return if it already exists
	if _, err := os.Stat(profilePath); err == nil {
		return profilePath, nil
	}

	log.Println("Building Essentia SVM Profile YAML...")

	yamlContent := `outputFormat: json
outputFrames: 0
lowlevel: { compute: 1 }
rhythm: { compute: 1 }
tonal: { compute: 1 }
highlevel:
  compute: 1
  svm_models:
`

	// Walk the directory and build the YAML array
	err := filepath.Walk(modelsDir, func(path string, info os.FileInfo, err error) error {
		if err == nil && strings.HasSuffix(info.Name(), ".history") {
			yamlContent += fmt.Sprintf("    - %s\n", path)
		}
		return nil
	})

	if err != nil {
		return "", fmt.Errorf("failed to scan models: %w", err)
	}

	err = os.WriteFile(profilePath, []byte(yamlContent), 0644)
	return profilePath, err
}

func AnalyzeDeep(path string) (*DeepAnalysis, error) {
	absPath, _ := filepath.Abs(path)

	// 1. Create a "Safe" temporary WAV file (44.1kHz, Mono)
	safeWav := absPath + ".safe.wav"
	jsonPath := absPath + ".json"

	log.Printf("Pre-transcoding: %s", filepath.Base(path))

	convCmd := exec.Command("ffmpeg", "-y", "-i", absPath, "-ar", "44100", "-ac", "1", "-f", "wav", safeWav)
	if out, err := convCmd.CombinedOutput(); err != nil {
		log.Printf("Pre-transcode failed: %v | %s", err, string(out))
		return nil, err
	}
	defer os.Remove(safeWav)

	// 2. Ensure the SVM Profile exists
	profilePath, err := autoGenerateProfile()
	if err != nil {
		log.Printf("Warning: Failed to generate SVM profile: %v. Running without high-level models.", err)
		profilePath = ""
	}

	// 3. Run the extractor
	log.Printf("Running Essentia...")
	var cmd *exec.Cmd
	if profilePath != "" {
		cmd = exec.Command("streaming_extractor_music", safeWav, jsonPath, profilePath)
	} else {
		cmd = exec.Command("streaming_extractor_music", safeWav, jsonPath)
	}

	out, err := cmd.CombinedOutput()
	if err != nil {
		log.Printf("Essentia failed: %v\nOutput: %s", err, string(out))
		return nil, fmt.Errorf("essentia crash")
	}

	// 4. Read the generated JSON
	data, err := os.ReadFile(jsonPath)
	if err != nil {
		return nil, err
	}
	defer os.Remove(jsonPath)

	var raw EssentiaJSON
	if err := json.Unmarshal(data, &raw); err != nil {
		log.Printf("Failed to parse JSON: %v", err)
		return nil, err
	}

	// 5. Parse out the positive ML Model results
	var rawTags []string
	for _, data := range raw.HighLevel {
		if !strings.HasPrefix(data.Value, "not_") && data.Value != "" {
			rawTags = append(rawTags, data.Value)
		}
	}

	// ⚡️ Run the tags through the translation engine!
	sortedTags := TranslateAndSortTags(rawTags)

	// 6. Map the final result
	analysis := &DeepAnalysis{
		BPM:               raw.Rhythm.BPM,
		MusicalKey:        raw.Tonal.KeyEdma.Key,
		Scale:             raw.Tonal.KeyEdma.Scale,
		Danceability:      raw.Rhythm.Danceability,
		Loudness:          raw.LowLevel.AverageLoudness,
		Duration:          raw.Metadata.AudioProperties.Length,
		Energy:            raw.LowLevel.SpectralEnergy.Mean,
		MLMoods:           sortedTags.Moods,
		MLGenres:          sortedTags.Genres,
		MLCharacteristics: sortedTags.Characteristics,
	}

	log.Printf("Result: %s | %.2f BPM | %s %s | Genres: %v | Moods: %v | Chars: %v",
		filepath.Base(path),
		analysis.BPM,
		analysis.MusicalKey,
		analysis.Scale,
		analysis.MLGenres,
		analysis.MLMoods,
		analysis.MLCharacteristics,
	)
	return analysis, nil
}
