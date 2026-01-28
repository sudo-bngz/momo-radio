package main

import (
	"flag"
	"log"

	"momo-radio/internal/config"
	database "momo-radio/internal/db"
	"momo-radio/internal/dj"
	"momo-radio/internal/radio"
	"momo-radio/internal/storage"
)

func main() {
	// 1. Parse Flags
	timetablePath := flag.String("timetable", "timetable.yaml", "Path to the scheduling YAML file")
	flag.Parse()

	log.SetFlags(log.LstdFlags | log.Lshortfile)
	log.Println("Starting GoWebRadio Engine (Modular + Database)...")

	// 2. Load Config
	cfg := config.Load()

	// 3. Init Infrastructure
	store := storage.New(cfg)
	db := database.New(cfg)

	// 4. Run Database Migrations
	db.AutoMigrate()

	// 5. Load Timetable (The Mythology)
	// We use the path provided by the flag (defaults to "timetable.yaml")
	log.Printf("📅 Loading schedule from: %s", *timetablePath)
	if err := dj.LoadTimetable(*timetablePath); err != nil {
		log.Fatalf("❌ Failed to load timetable: %v", err)
	}

	// 6. Register Metrics
	radio.RegisterMetrics()

	// 7. Start Engine
	engine := radio.New(cfg, store, db)
	engine.Run()
}
