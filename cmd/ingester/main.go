package main

import (
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
	log.Println("Starting Radio Ingestion Worker (Modular + Database)...")

	// 1. Setup Configuration
	cfg := config.Load()

	// 2. Initialize Infrastructure
	store := storage.New(cfg)
	db := database.New(cfg) // Connect to Postgres

	// 3. Run Database Migrations
	db.AutoMigrate()

	// 4. Setup Metrics
	ingest.RegisterMetrics()
	go func() {
		http.Handle("/metrics", promhttp.Handler())
		log.Printf("📊 Metrics exposed at http://localhost%s/metrics", cfg.Server.MetricsPort)
		log.Fatal(http.ListenAndServe(cfg.Server.MetricsPort, nil))
	}()

	// Ensure temp directory exists for processing
	os.MkdirAll(cfg.Server.TempDir, 0755)

	// 5. Start Worker
	worker := ingest.New(cfg, store, db)

	worker.Run()
}
