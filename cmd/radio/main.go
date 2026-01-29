package main

import (
	"log"

	"momo-radio/internal/config"
	database "momo-radio/internal/db"
	"momo-radio/internal/radio"
	"momo-radio/internal/storage"
)

func main() {
	// 1. Setup Logging
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	log.Println("🚀 Starting Momo Radio Engine (Modular + DB Scheduler)...")

	// 2. Load Config
	cfg := config.Load()

	// 3. Init Infrastructure
	// We initialize the storage (S3/B2) and the Database (Postgres/SQLite)
	store := storage.New(cfg)
	db := database.New(cfg)

	// 4. Run Database Migrations
	// This ensures the 'tracks', 'play_histories', and 'schedules' tables exist
	log.Println("📦 Running Database Migrations...")
	db.AutoMigrate()

	// Seeds (Create default schedule if missing)
	database.SeedSchedules(db.DB)

	// 5. Register Prometheus Metrics
	radio.RegisterMetrics()

	// 6. Start the Radio Engine
	// The engine will internally initialize the DJs (Mixer + Scheduler)
	log.Println("🎧 Initializing Radio Engine...")
	engine := radio.New(cfg, store, db)

	// This blocks forever
	engine.Run()
}
