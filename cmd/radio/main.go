package main

import (
	"flag"
	"log"

	"momo-radio/internal/config"
	database "momo-radio/internal/db"
	"momo-radio/internal/radio"
	"momo-radio/internal/storage"
)

func main() {
	// 1. Parse Flags
	// We add flags to override config.yaml values
	simulate := flag.Bool("simulate", false, "Dry run: Generate playlist to stdout without streaming")
	provider := flag.String("provider", "", "Override DJ provider (harmonic, starvation, timetable)")
	flag.Parse()

	log.SetFlags(log.LstdFlags | log.Lshortfile)

	// 2. Load Config
	cfg := config.Load()

	// 3. Apply Flag Overrides
	if *simulate {
		cfg.Radio.DryRun = true
	}
	if *provider != "" {
		cfg.Radio.Provider = *provider
	}

	if cfg.Radio.DryRun {
		log.Println("🧪 MODE: DRY RUN / SIMULATION")
		log.Println("   - No Audio Output")
		log.Println("   - Database will NOT be updated (Read-Only)")
		log.Println("   - Storage will NOT be touched")
	} else {
		log.Println("🚀 Starting Momo Radio Engine (Live Mode)...")
	}

	// 4. Init Infrastructure
	store := storage.New(cfg)
	db := database.New(cfg)

	// 5. Run Migrations (Safe to run even in dry run)
	db.AutoMigrate()

	// 6. Start Engine
	engine := radio.New(cfg, store, db)
	engine.Run()
}
