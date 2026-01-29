package dj

import (
	"time"
)

// --- 1. THE CONTRACT (Interface) ---

// Track represents the generic track data returned to the engine.
// This decouples the engine from specific DB models.
type Track struct {
	ID       uint
	Key      string
	Artist   string
	Title    string
	Duration time.Duration
}

// Provider is the interface any DJ algorithm in 'pkg/dj/mix' must satisfy.
// The engine (main.go) uses this interface to request music.
type Provider interface {
	GetNextTrack() (*Track, error)
	Name() string
}

// --- 2. SHARED TYPES (Configuration) ---

// SlotRules defines constraints for a radio slot.
// This is used by the Scheduler (in 'mix') to tell the Provider what to play.
type SlotRules struct {
	Name    string
	Genre   string
	Styles  []string // e.g. ["techno", "dub"]
	MinBPM  float64
	MaxBPM  float64
	MinYear int
	MaxYear int
}
