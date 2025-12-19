package main

import (
	"log"
	"net/http"
	"os"

	"github.com/prometheus/client_golang/prometheus/promhttp"

	"momo-radio/internal/config"
	"momo-radio/internal/ingest"
	"momo-radio/internal/storage"
)

func main() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	log.Println("Starting Radio Ingestion Worker...")

	// 1. Setup
	cfg := config.Load()
	store := storage.New(cfg)

	// Metrics
	ingest.RegisterMetrics()
	go func() {
		http.Handle("/metrics", promhttp.Handler())
		log.Fatal(http.ListenAndServe(cfg.Server.MetricsPort, nil))
	}()

	os.MkdirAll(cfg.Server.TempDir, 0755)

	// 2. Start Worker
	worker := ingest.New(cfg, store)

	worker.Run()
}
