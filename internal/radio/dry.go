package radio

import (
	"fmt"
	"os"
	"strings"
	"text/tabwriter"
	"time"

	"momo-radio/internal/dj"
	"momo-radio/internal/dj/mix"
	"momo-radio/internal/models"
)

// runSimulation runs a fast-forward playlist generation
func (e *Engine) runSimulation() {
	// 1. Initialize the selected Music Provider
	var musicDeck dj.Provider
	providerName := strings.ToLower(e.cfg.Radio.Provider)

	switch providerName {
	case "harmonic":
		musicDeck = mix.NewDeck(e.storage, e.db, "music/")
	case "timetable":
		// Timetable implies strict adherence, usually Starvation is safest
		musicDeck = mix.NewStarvationProvider(e.db.DB, "music/")
	case "starvation":
		fallthrough
	default:
		musicDeck = mix.NewStarvationProvider(e.db.DB, "music/")
	}

	fmt.Printf("\n--- 🧪 DRY PLAYLIST SIMULATION (%s) ---\n", providerName)
	fmt.Println("Note: DB Play Counts are NOT updated.")
	fmt.Println("--------------------------------------------------------------------------------")

	// 3. Setup TabWriter (Standard Lib)
	// NewWriter(output, minwidth, tabwidth, padding, padchar, flags)
	w := tabwriter.NewWriter(os.Stdout, 0, 0, 3, ' ', 0)

	// Print Header
	fmt.Fprintln(w, "TIME\tTYPE\tARTIST\tTITLE\tBPM\tKEY\tPROGRAM")
	fmt.Fprintln(w, "----\t----\t------\t-----\t---\t---\t-------")

	// 4. Simulation Loop
	const Limit = 20
	songsSinceJingle := 0
	simulatedTime := time.Now()

	for i := 0; i < Limit; i++ {
		var track *dj.Track
		var err error
		trackType := "Music"

		// B. Music Logic
		if track == nil {
			track, err = musicDeck.GetNextTrack()
			if err != nil {
				fmt.Printf("\n❌ Critical: Music deck returned error: %v\n", err)
				break
			}
			songsSinceJingle++
		}

		// C. Fetch Extra Details for Display
		var fullInfo models.Track
		// We ignore errors here (if track is missing, it just shows 0/empty)
		e.db.DB.First(&fullInfo, track.ID)

		// D. Print Row
		fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%.0f\t%s\t%s\n",
			simulatedTime.Format("15:04:05"),
			trackType,
			truncate(track.Artist, 20),
			truncate(track.Title, 25),
			fullInfo.BPM,
			fullInfo.MusicalKey,
			musicDeck.Name(),
		)

		// Advance simulated time
		simulatedTime = simulatedTime.Add(track.Duration)
	}

	// 5. Flush (Render)
	w.Flush()

	fmt.Println("\n✅ Simulation Complete.")
}

func truncate(s string, max int) string {
	if len(s) > max {
		return s[:max-3] + "..."
	}
	return s
}
