package audio

import (
	"momo-radio/internal/models"
	"testing"
)

func TestAreKeysCompatible(t *testing.T) {
	tests := []struct {
		k1, s1, k2, s2 string
		want           bool
	}{
		// 1. Exact Match
		{"C", "major", "C", "major", true}, // 8B -> 8B
		{"A", "minor", "A", "minor", true}, // 8A -> 8A

		// 2. Relative Major/Minor
		{"C", "major", "A", "minor", true}, // 8B -> 8A (Compatible)
		{"A", "minor", "C", "major", true}, // 8A -> 8B (Compatible)

		// 3. Adjacent (Energy Shift)
		{"C", "major", "G", "major", true}, // 8B -> 9B (+1)
		{"C", "major", "F", "major", true}, // 8B -> 7B (-1)

		// 4. Wrap Around (12 -> 1)
		{"E", "major", "B", "major", true}, // 12B -> 1B (Compatible)

		// 5. Clashes (The "Trainwreck" check)
		{"C", "major", "F#", "major", false}, // 8B -> 2B (Tritone clash)
		{"C", "major", "Eb", "major", false}, // 8B -> 5B (Clash)
	}

	for _, tt := range tests {
		got := areKeysCompatible(tt.k1, tt.s1, tt.k2, tt.s2)
		if got != tt.want {
			t.Errorf("areKeysCompatible(%s %s, %s %s) = %v; want %v",
				tt.k1, tt.s1, tt.k2, tt.s2, got, tt.want)
		}
	}
}

func TestCalculateMixScore(t *testing.T) {
	// Setup dummy tracks
	trackA := models.Track{BPM: 120, MusicalKey: "C", Scale: "major", Danceability: 1.0} // 8B

	// Case 1: Perfect Mix
	trackB := models.Track{BPM: 120, MusicalKey: "G", Scale: "major", Danceability: 1.1} // 9B
	score1 := CalculateMixScore(trackA, trackB)

	// Case 2: Bad Mix (Huge BPM Jump + Key Clash)
	trackC := models.Track{BPM: 140, MusicalKey: "F#", Scale: "major", Danceability: 2.5} // 2B
	score2 := CalculateMixScore(trackA, trackC)

	if score1 >= score2 {
		t.Errorf("Expected perfect mix score (%f) to be lower than trainwreck score (%f)", score1, score2)
	}

	if score1 >= 0 {
		t.Errorf("Expected bonus for harmonic mixing (negative score), got %f", score1)
	}
}
