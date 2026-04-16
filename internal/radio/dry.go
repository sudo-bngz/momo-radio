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

func (e *Engine) runSimulation() {
	fmt.Printf("\n--- DRY PLAYLIST SIMULATION ---\n")
	fmt.Println("Logic: Uses Scheduler + Selector Strategy (No DB updates)")
	fmt.Println("--------------------------------------------------------------------------------")

	w := tabwriter.NewWriter(os.Stdout, 0, 0, 3, ' ', 0)
	defer w.Flush()

	fmt.Fprintln(w, "TIME\tMODE\tARTIST\tTITLE\tBPM\tKEY\tPROGRAM")
	fmt.Fprintln(w, "----\t----\t------\t-----\t---\t---\t-------")

	selectors := map[string]dj.Selector{
		"random":     dj.NewSelector("random", e.db.DB),
		"harmonic":   dj.NewSelector("harmonic", e.db.DB),
		"starvation": dj.NewSelector("starvation", e.db.DB),
	}

	const Limit = 20
	simulatedTime := time.Now()
	var lastTrack *models.Track

	for i := 0; i < Limit; i++ {
		activeSlot := e.scheduler.GetCurrentSchedule()
		showName := getShowName(activeSlot)

		var selectedTrack *models.Track
		var err error
		currentMode := "Unknown"

		if activeSlot.Playlist != nil {
			currentMode = "Playlist"
			selectedTrack, err = e.pickNextFromPlaylist(activeSlot.Playlist.ID)
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
			selectedTrack, err = selector.PickTrack(activeSlot.RuleSet, lastTrack)
		}

		if err != nil || selectedTrack == nil {
			fmt.Fprintf(w, "%s\tERROR\t---\tSelection Failed: %v\t---\t---\t%s\n",
				simulatedTime.Format("15:04:05"), err, showName)
			break
		}

		fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%.0f\t%s\t%s\n",
			simulatedTime.Format("15:04:05"),
			currentMode,
			truncate(selectedTrack.Artist.Name, 20),
			truncate(selectedTrack.Title, 25),
			selectedTrack.BPM,
			selectedTrack.MusicalKey,
			showName,
		)

		lastTrack = selectedTrack
		duration := time.Duration(selectedTrack.Duration) * time.Second
		if duration == 0 {
			duration = 4 * time.Minute
		}
		simulatedTime = simulatedTime.Add(duration)
	}

	fmt.Println("\nSimulation Complete. Above is what your listeners would hear right now.")
}

func truncate(s string, max int) string {
	if len(s) > max {
		return s[:max-3] + "..."
	}
	return s
}
