package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/redis/go-redis/v9"

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
		// Compatible with Go 1.24+ strings.SplitSeq, or fallback to strings.Split
		for _, a := range strings.Split(s, ",") {
			targetArtists = append(targetArtists, strings.TrimSpace(a))
		}
		return nil
	})

	flag.Parse()

	// 2. Setup Configuration
	cfg := config.Load()

	// 3. Initialize Infrastructure (Storage, DB, Redis)
	store := storage.New(cfg)
	db := database.New(cfg)

	// 4. Initialize Redis Client
	redisAddr := fmt.Sprintf("%s:%s", cfg.Redis.Host, cfg.Redis.Port)
	redisClient := redis.NewClient(&redis.Options{
		Addr:     redisAddr,
		Password: cfg.Redis.Password,
		DB:       cfg.Redis.DB,
	})

	// 5. Run Database Migrations
	db.AutoMigrate()

	// Ensure temp directory exists
	if err := os.MkdirAll(cfg.Server.TempDir, 0755); err != nil {
		log.Fatalf("Failed to create temp dir: %v", err)
	}

	// 6. Create the Asynq Worker
	worker := ingest.New(cfg, store, db, redisClient)

	// 7. MODE SELECTION (CLI Maintenance)
	if *repairMeta || *repairAudio || *repairCountry {
		log.Println("MAINTENANCE MODE ACTIVE")
		log.Printf("Storage Provider: %s", cfg.Storage.Provider)

		if *repairAudio {
			log.Println("Starting Audio Repair (Essentia)...")
			worker.RepairAudio()
		}

		if *repairMeta {
			log.Println("Starting Metadata Repair...")
			worker.RepairMetadata()
		}

		if *repairCountry {
			if *dryRun {
				log.Println("MODE: DRY RUN (No DB writes)")
			}
			log.Printf("Starting Country Repair (%s) for %d targets...", *repairProvider, len(targetArtists))
			worker.RepairCountry(*dryRun, targetArtists, *repairProvider)
		}

		log.Println("All maintenance tasks finished. Exiting.")
		return
	}

	// 8. NORMAL OPERATION
	log.Printf("Starting Radio Ingestion Worker [Storage: %s]...", cfg.Storage.Provider)

	// 9. Setup Metrics
	ingest.RegisterMetrics()
	go func() {
		http.Handle("/metrics", promhttp.Handler())
		log.Printf("Metrics exposed at http://localhost%s/metrics", cfg.Server.MetricsPort)
		if err := http.ListenAndServe(cfg.Server.MetricsPort, nil); err != nil {
			log.Printf("Metrics server failed: %v", err)
		}
	}()

	// 9. Start Asynq Server (Blocks forever)
	if err := worker.StartServer(); err != nil {
		log.Fatalf("Failed to start Asynq worker: %v", err)
	}
}
