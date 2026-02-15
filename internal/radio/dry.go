package radio

import (
	"fmt"
	"os"
	"strings"
	"text/tabwriter"
	"time"

	"momo-radio/internal/dj"
	"momo-radio/internal/models"
)

// runSimulation runs a fast-forward playlist generation based on current Scheduler rules.
func (e *Engine) runSimulation() {
	fmt.Printf("\n--- 🧪 DRY PLAYLIST SIMULATION ---\n")
	fmt.Println("Logic: Uses Scheduler + Selector Strategy (No DB updates)")
	fmt.Println("--------------------------------------------------------------------------------")

	// 1. Setup TabWriter for clean CLI output
	w := tabwriter.NewWriter(os.Stdout, 0, 0, 3, ' ', 0)
	defer w.Flush()

	// Print Header
	fmt.Fprintln(w, "TIME\tMODE\tARTIST\tTITLE\tBPM\tKEY\tPROGRAM")
	fmt.Fprintln(w, "----\t----\t------\t-----\t---\t---\t-------")

	// 2. Initialize Selectors (Strategy Pattern)
	selectors := map[string]dj.Selector{
		"random":     dj.NewSelector("random", e.db.DB),
		"harmonic":   dj.NewSelector("harmonic", e.db.DB),
		"starvation": dj.NewSelector("starvation", e.db.DB),
	}

	// 3. Simulation Variables
	const Limit = 20
	simulatedTime := time.Now()
	var lastTrack *models.Track // Tracks state for Harmonic transitions

	for i := 0; i < Limit; i++ {
		// A. Ask the Scheduler what is active at the 'simulatedTime'
		// Note: To make this 100% accurate, your Scheduler Manager would need
		// an 'AtTime(t time.Time)' method. For now, we use current clock logic.
		activeSlot := e.scheduler.GetCurrentSchedule()

		var selectedTrack *models.Track
		var err error
		currentMode := "Unknown"

		// B. Selection Logic (Mirrors Production Orchestrator)
		if activeSlot.PlaylistID != nil {
			currentMode = "Playlist"
			selectedTrack, err = e.pickNextFromPlaylist(*activeSlot.PlaylistID)
		} else if activeSlot.RuleSet != nil {
			mode := strings.ToLower(activeSlot.RuleSet.Mode)
			if mode == "" {
				mode = "random"
			}

			selector, exists := selectors[mode]
			if !exists {
				selector = selectors["random"]
			}

			currentMode = selector.Name()
			// We pass 'lastTrack' so Harmonic simulation works!
			selectedTrack, err = selector.PickTrack(activeSlot.RuleSet, lastTrack)
		}

		// Handle Selection Errors
		if err != nil || selectedTrack == nil {
			fmt.Fprintf(w, "%s\tERROR\t---\tSelection Failed: %v\t---\t---\t%s\n",
				simulatedTime.Format("15:04:05"), err, activeSlot.Name)
			break
		}

		// C. Print Row
		fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%.0f\t%s\t%s\n",
			simulatedTime.Format("15:04:05"),
			currentMode,
			truncate(selectedTrack.Artist, 20),
			truncate(selectedTrack.Title, 25),
			selectedTrack.BPM,
			selectedTrack.MusicalKey,
			activeSlot.Name,
		)

		// D. Advance Simulated State
		lastTrack = selectedTrack
		// Use a 4-minute default if duration is 0 to keep the list moving
		duration := time.Duration(selectedTrack.Duration) * time.Second
		if duration == 0 {
			duration = 4 * time.Minute
		}
		simulatedTime = simulatedTime.Add(duration)
	}

	fmt.Println("\n✅ Simulation Complete. Above is what your listeners would hear right now.")
}

func truncate(s string, max int) string {
	if len(s) > max {
		return s[:max-3] + "..."
	}
	return s
}
