package audio

import (
	"math"
	"momo-radio/internal/models"
	"strings"
)

// CalculateMixScore determines how well 'next' follows 'prev'.
// Lower score = better mix. 0.0 is neutral. Negative is a bonus.
func CalculateMixScore(prev, next models.Track) float64 {
	score := 0.0

	// --- 1. BPM CONTINUITY (The Anchor) ---
	// Large jumps are bad.
	bpmDiff := math.Abs(prev.BPM - next.BPM)
	bpmRatio := bpmDiff / prev.BPM

	if bpmRatio > 0.06 {
		// >6% difference (e.g. 120 -> 128) is penalized heavily
		score += 100.0
	} else {
		// <6% is acceptable, small penalty
		score += bpmRatio * 20
	}

	// --- 2. HARMONIC MIXING (The Magic) ---
	// Bonus if keys match or are compatible (Camelot Wheel)
	if areKeysCompatible(prev.MusicalKey, prev.Scale, next.MusicalKey, next.Scale) {
		score -= 20.0
	}

	// --- 3. ENERGY FLOW ---
	// Prevent jumping from Chill (0.2) to Hard (0.9)
	danceDiff := math.Abs(prev.Danceability - next.Danceability)
	if danceDiff > 0.8 {
		score += 40.0
	}

	return score
}

// --- HARMONY ENGINE (Camelot System) ---

type CamelotKey struct {
	Num    int    // 1-12
	Letter string // A (Minor) or B (Major)
}

func areKeysCompatible(k1, s1, k2, s2 string) bool {
	c1, ok1 := toCamelot(k1, s1)
	c2, ok2 := toCamelot(k2, s2)

	if !ok1 || !ok2 {
		return false
	}

	// Rule 1: Exact Match (8B -> 8B)
	if c1.Num == c2.Num && c1.Letter == c2.Letter {
		return true
	}

	// Rule 2: Major/Minor Swap (8B <-> 8A)
	if c1.Num == c2.Num && c1.Letter != c2.Letter {
		return true
	}

	// Rule 3: Energy Shift (Adjacent Numbers: 8 -> 9 or 8 -> 7)
	if c1.Letter == c2.Letter {
		diff := int(math.Abs(float64(c1.Num - c2.Num)))
		if diff == 1 || diff == 11 { // 11 handles the 12->1 wrap
			return true
		}
	}

	return false
}

func toCamelot(keyRaw, scaleRaw string) (CamelotKey, bool) {
	// Normalize: "ab" -> "Ab", "MAJOR" -> "major"
	key := normalizeKey(keyRaw)
	scale := strings.ToLower(strings.TrimSpace(scaleRaw))

	// Create lookup string: "Ab_major"
	lookupKey := key + "_" + scale

	// Your DB format uses sharps (C#) and flats (Ab, Bb, Eb).
	// This map handles both to be safe.
	lookup := map[string]CamelotKey{
		// --- MAJOR KEYS (B) ---
		"B_major":  {1, "B"},
		"F#_major": {2, "B"}, "Gb_major": {2, "B"},
		"Db_major": {3, "B"}, "C#_major": {3, "B"},
		"Ab_major": {4, "B"}, "G#_major": {4, "B"},
		"Eb_major": {5, "B"}, "D#_major": {5, "B"},
		"Bb_major": {6, "B"}, "A#_major": {6, "B"},
		"F_major": {7, "B"},
		"C_major": {8, "B"},
		"G_major": {9, "B"},
		"D_major": {10, "B"},
		"A_major": {11, "B"},
		"E_major": {12, "B"},

		// --- MINOR KEYS (A) ---
		"Ab_minor": {1, "A"}, "G#_minor": {1, "A"},
		"Eb_minor": {2, "A"}, "D#_minor": {2, "A"},
		"Bb_minor": {3, "A"}, "A#_minor": {3, "A"},
		"F_minor":  {4, "A"},
		"C_minor":  {5, "A"},
		"G_minor":  {6, "A"},
		"D_minor":  {7, "A"},
		"A_minor":  {8, "A"},
		"E_minor":  {9, "A"},
		"B_minor":  {10, "A"},
		"F#_minor": {11, "A"}, "Gb_minor": {11, "A"},
		"Db_minor": {12, "A"}, "C#_minor": {12, "A"},
	}

	val, exists := lookup[lookupKey]
	return val, exists
}

func normalizeKey(k string) string {
	k = strings.TrimSpace(k)
	if len(k) > 0 {
		// Uppercase first letter, rest lowercase (just in case)
		// This turns "ab" into "Ab" and "AB" into "Ab"
		return strings.ToUpper(k[:1]) + k[1:]
	}
	return k
}
