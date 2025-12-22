package main

import (
	"log"

	"momo-radio/internal/config"
	database "momo-radio/internal/db"
	"momo-radio/internal/radio"
	"momo-radio/internal/storage"
)

func main() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	log.Println("Starting GoWebRadio Engine (Modular + Database)...")

	// 1. Load Config
	cfg := config.Load()

	// 2. Init Infrastructure
	store := storage.New(cfg)
	db := database.New(cfg)

	// 3. Run Database Migrations
	db.AutoMigrate()

	// 4. Register Metrics
	radio.RegisterMetrics()

	// 5. Start Engine
	// Pass the database client to the engine so it can be used by the DJ
	engine := radio.New(cfg, store, db)
	engine.Run()
}
