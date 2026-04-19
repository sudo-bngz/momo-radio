package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/redis/go-redis/v9"

	"momo-radio/internal/config"
	database "momo-radio/internal/db"
	"momo-radio/internal/storage"

	apiserver "momo-radio/internal/api/server"
)

func main() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	log.Println("Starting Radio API Server...")

	// 1. Setup Configuration
	cfg := config.Load()

	// 2. Initialize Infrastructure
	db := database.New(cfg)

	// 3. Initialize Redis Client
	redisAddr := fmt.Sprintf("%s:%s", cfg.Redis.Host, cfg.Redis.Port)
	redisClient := redis.NewClient(&redis.Options{
		Addr:     redisAddr,
		Password: cfg.Redis.Password,
		DB:       cfg.Redis.DB,
	})

	// 4. Run Database Migrations
	db.AutoMigrate()

	// 5. Seeding users
	database.SeedAdminUser(db.DB)

	// 6. Storage
	store := storage.New(cfg)

	// 7. Setup Metrics
	go func() {
		http.Handle("/_metrics", promhttp.Handler())
		log.Printf("Metrics exposed at http://localhost%s/_metrics", cfg.Server.MetricsPort)
		if err := http.ListenAndServe(cfg.Server.MetricsPort, nil); err != nil {
			log.Printf("Metrics server error: %v", err)
		}
	}()

	// 8. Start Server
	srv := apiserver.New(cfg, db, store, redisClient)

	port := ":8081"
	log.Printf("API Server starting on %s", port)

	if err := srv.Start(port); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
