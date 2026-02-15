package main

import (
	"log"
	"net/http"

	"github.com/prometheus/client_golang/prometheus/promhttp"

	"momo-radio/internal/config"
	database "momo-radio/internal/db"
	"momo-radio/internal/storage"

	// Use an alias to prevent naming collisions with the 'server' variable
	apiserver "momo-radio/internal/api/server"
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
	// Optional: Seed initial data
	// If you just added RBAC, you should create a default Admin user here!
	database.SeedAdminUser(db.DB)

	// 4. Storage
	store := storage.New(cfg)

	// 5. Setup Metrics
	go func() {
		http.Handle("/_metrics", promhttp.Handler())
		log.Printf("📊 Metrics exposed at http://localhost%s/_metrics", cfg.Server.MetricsPort)
		if err := http.ListenAndServe(cfg.Server.MetricsPort, nil); err != nil {
			log.Printf("⚠️ Metrics server error: %v", err)
		}
	}()

	// 6. Start Server
	// Call New() from the aliased package
	srv := apiserver.New(cfg, db, store)

	port := ":8081"
	log.Printf("🚀 API Server starting on %s", port)

	if err := srv.Start(port); err != nil {
		log.Fatalf("❌ Server failed to start: %v", err)
	}
}
