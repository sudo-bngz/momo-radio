package radio

import (
	"fmt"
	"os"
	"strings"
	"text/tabwriter"
	"time"

	"github.com/google/uuid"

	"momo-radio/internal/dj"
	"momo-radio/internal/models"
)

// ⚡️ Added orgID to simulate a specific tenant's station
func (e *Engine) runSimulation(orgID uuid.UUID) {
	fmt.Printf("\n--- DRY PLAYLIST SIMULATION FOR TENANT: %s ---\n", orgID.String())
	fmt.Println("Logic: Uses Scheduler + Selector Strategy (No DB updates)")
	fmt.Println("--------------------------------------------------------------------------------")

	w := tabwriter.NewWriter(os.Stdout, 0, 0, 3, ' ', 0)
	defer w.Flush()

	fmt.Fprintln(w, "TIME\tMODE\tARTIST\tTITLE\tBPM\tKEY\tPROGRAM")
	fmt.Fprintln(w, "----\t----\t------\t-----\t---\t---\t-------")

	// ⚡️ Pass orgID into the Selectors
	selectors := map[string]dj.Selector{
		"random":     dj.NewSelector("random", e.db.DB, orgID),
		"harmonic":   dj.NewSelector("harmonic", e.db.DB, orgID),
		"starvation": dj.NewSelector("starvation", e.db.DB, orgID),
	}

	const Limit = 20
	simulatedTime := time.Now()
	var lastTrack *models.Track

	for i := 0; i < Limit; i++ {
		// ⚡️ Pass orgID into the Scheduler
		activeSlot := e.scheduler.GetCurrentSchedule(orgID)
		showName := getShowName(activeSlot)

		var selectedTrack *models.Track
		var err error
		currentMode := "Unknown"

		if activeSlot != nil && activeSlot.Playlist != nil {
			currentMode = "Playlist"
			// ⚡️ Pass orgID into the Playlist Picker
			selectedTrack, err = e.pickNextFromPlaylist(orgID, activeSlot.Playlist.ID, lastTrack)
		} else if activeSlot != nil && activeSlot.RuleSet != nil {
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

		// ⚡️ NEW: Join multiple artists for the CLI output
		var artistNames []string
		for _, a := range selectedTrack.Artists {
			artistNames = append(artistNames, a.Name)
		}
		artistStr := "Unknown Artist"
		if len(artistNames) > 0 {
			artistStr = strings.Join(artistNames, ", ")
		}

		fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%.0f\t%s\t%s\n",
			simulatedTime.Format("15:04:05"),
			currentMode,
			truncate(artistStr, 20), // ⚡️ Pass the joined string here
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
