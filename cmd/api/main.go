package main

import (
	"log"
	"net/http"

	"github.com/prometheus/client_golang/prometheus/promhttp"

	"momo-radio/internal/api"
	"momo-radio/internal/config"
	database "momo-radio/internal/db"
)

func main() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	log.Println("Starting Radio API Server...")

	// 1. Setup Configuration
	cfg := config.Load()

	// 2. Initialize Infrastructure
	db := database.New(cfg)

	// 3. Run Database Migrations
	db.AutoMigrate()

	// 4. Setup Metrics
	go func() {
		http.Handle("/_metrics", promhttp.Handler())
		log.Printf("📊 Metrics exposed at http://localhost%s/_metrics", cfg.Server.MetricsPort)
		if err := http.ListenAndServe(cfg.Server.MetricsPort, nil); err != nil {
			log.Printf("⚠️ Metrics server error: %v", err)
		}
	}()

	// 5. Start Server
	server := api.New(cfg, db)

	port := ":8081"
	log.Printf("🚀 API Server starting on %s", port)

	if err := server.Start(port); err != nil {
		log.Fatalf("❌ Server failed to start: %v", err)
	}
}
