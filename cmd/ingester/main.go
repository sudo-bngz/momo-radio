package main

import (
	"flag"
	"log"
	"net/http"
	"os"

	"github.com/prometheus/client_golang/prometheus/promhttp"

	"momo-radio/internal/config"
	database "momo-radio/internal/db"
	"momo-radio/internal/ingest"
	"momo-radio/internal/storage"
)

func main() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)

	// 1. Define Flags
	repairMeta := flag.Bool("repair-metadata", false, "Run Discogs enrichment on existing tracks")
	repairAudio := flag.Bool("repair-audio", false, "Run Essentia analysis on tracks missing BPM/Key")
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
	if *repairMeta || *repairAudio {
		log.Println("🛠️ MAINTENANCE MODE ACTIVE")

		if *repairAudio {
			log.Println(">>> Starting Audio Repair (Essentia)...")
			worker.RepairAudio()
		}

		if *repairMeta {
			log.Println(">>> Starting Metadata Repair (Discogs)...")
			worker.RepairMetadata()
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
