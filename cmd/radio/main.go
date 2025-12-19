package main

import (
	"log"

	"momo-radio/internal/config"
	"momo-radio/internal/radio"
	"momo-radio/internal/storage"
)

func main() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	log.Println("Starting GoWebRadio Engine...")

	// 1. Load Config
	// Uses the shared config package (Viper + Env Vars)
	cfg := config.Load()

	// 2. Init Storage
	// Initializes the S3/B2 client used by both the DJ (listing) and Uploader (pushing)
	store := storage.New(cfg)

	// 3. Register Metrics
	// Registers Prometheus counters defined in the internal/radio package
	radio.RegisterMetrics()

	// 4. Start Engine
	// Initializes the Engine with dependencies and starts the blocking Run loop
	engine := radio.New(cfg, store)
	engine.Run()
}
