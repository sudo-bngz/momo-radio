package main

import (
	"flag" // 1. Add this import
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

	// 2. Define the flag
	repairMode := flag.Bool("repair", false, "Set to true to run the metadata repair script")
	flag.Parse()

	// 1. Setup Configuration
	cfg := config.Load()

	// 2. Initialize Infrastructure
	store := storage.New(cfg)
	db := database.New(cfg)

	// 3. Run Database Migrations
	db.AutoMigrate()

	// Ensure temp directory exists
	os.MkdirAll(cfg.Server.TempDir, 0755)

	// 4. Create Worker
	worker := ingest.New(cfg, store, db)

	// 3. Logic: If flag is present, repair and exit. Otherwise, run metrics and worker.
	if *repairMode {
		log.Println("🛠️ REPAIR MODE ACTIVE: Starting metadata cleanup...")
		worker.RepairMetadata()
		log.Println("✅ Repair finished. Exiting.")
		return
	}

	log.Println("Starting Radio Ingestion Worker (Modular + Database)...")

	// 4. Setup Metrics (Only if not in repair mode)
	ingest.RegisterMetrics()
	go func() {
		http.Handle("/metrics", promhttp.Handler())
		log.Printf("📊 Metrics exposed at http://localhost%s/metrics", cfg.Server.MetricsPort)
		log.Fatal(http.ListenAndServe(cfg.Server.MetricsPort, nil))
	}()

	// 5. Start Normal Worker
	worker.Run()
}
