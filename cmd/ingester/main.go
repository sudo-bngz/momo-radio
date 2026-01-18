package main

import (
	"flag"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/prometheus/client_golang/prometheus/promhttp"

	"momo-radio/internal/config"
	database "momo-radio/internal/db"
	"momo-radio/internal/ingest"
	"momo-radio/internal/storage"
)

func main() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)

	// 1. Define Flags
	repairMeta := flag.Bool("repair-metadata", false, "Run metadata enrichment on existing tracks")
	repairAudio := flag.Bool("repair-audio", false, "Run Essentia analysis on tracks missing BPM/Key")
	repairCountry := flag.Bool("repair-country", false, "Run Discogs enrichment on existing tracks")
	dryRun := flag.Bool("dry-run", false, "Do not save changes to DB (use with repair flags)")
	repairProvider := flag.String("provider", "musicbrainz", "Metadata provider: 'musicbrainz' or 'discogs'")
	var targetArtists []string
	flag.Func("artists", "Comma-separated list of artists to target (e.g. -artists='Daft Punk,Justice')", func(s string) error {
		for _, a := range strings.Split(s, ",") {
			targetArtists = append(targetArtists, strings.TrimSpace(a))
		}
		return nil
	})

	flag.Parse()

	// 2. Setup Configuration
	cfg := config.Load()

	// 3. Initialize Infrastructure
	store := storage.New(cfg)
	db := database.New(cfg)

	// 4. Run Database Migrations
	db.AutoMigrate()

	// Ensure temp directory exists
	if err := os.MkdirAll(cfg.Server.TempDir, 0755); err != nil {
		log.Fatalf("❌ Failed to create temp dir: %v", err)
	}

	// 5. Create Worker
	worker := ingest.New(cfg, store, db)

	// 6. MODE SELECTION
	// If any repair flag is set, run the specific repair and exit.
	if *repairMeta || *repairAudio || *repairCountry {
		log.Println("🛠️ MAINTENANCE MODE ACTIVE")

		if *repairAudio {
			log.Println(">>> Starting Audio Repair (Essentia)...")
			worker.RepairAudio()
		}

		if *repairMeta {
			log.Println(">>> Starting Metadata Repair (Discogs)...")
			worker.RepairMetadata()
		}

		if *repairCountry {
			if *dryRun {
				log.Println("🧪 MODE: DRY RUN (No DB writes)")
			}
			log.Printf(">>> Starting Country Repair (MusicBrainz) for %d targets...", len(targetArtists))
			worker.RepairCountry(*dryRun, targetArtists, *repairProvider)
		}

		log.Println("✅ All maintenance tasks finished. Exiting.")
		return
	}

	// 7. NORMAL OPERATION
	log.Println("📻 Starting Radio Ingestion Worker...")

	// Setup Metrics
	ingest.RegisterMetrics()
	go func() {
		http.Handle("/metrics", promhttp.Handler())
		log.Printf("📊 Metrics exposed at http://localhost%s/metrics", cfg.Server.MetricsPort)
		if err := http.ListenAndServe(cfg.Server.MetricsPort, nil); err != nil {
			log.Printf("❌ Metrics server failed: %v", err)
		}
	}()

	// Start Watcher Loop
	worker.Run()
}
