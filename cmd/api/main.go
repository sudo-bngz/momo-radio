package main

import (
	"fmt"
	"net/http"

	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"

	apiserver "momo-radio/internal/api/server"
	"momo-radio/internal/config"
	database "momo-radio/internal/db"
	"momo-radio/internal/logger"
	"momo-radio/internal/search"
	"momo-radio/internal/storage"
)

func main() {
	// Initialize Zap logger first so it catches startup events immediately
	logger.Init()
	defer logger.Sync()

	logger.Log.Info("Starting momo-radio api...")

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

	// 4. Initialize Search Engine
	meili := search.InitMeilisearch(cfg)

	// 5. Run Database Migrations
	db.AutoMigrate()

	// 6. Seeding users
	database.SeedDatabase(db.DB)

	// 7. Storage
	store := storage.New(cfg)

	// 8. Setup Metrics
	go func() {
		http.Handle("/_metrics", promhttp.Handler())
		logger.Log.Info("Metrics exposed",
			zap.String("url", fmt.Sprintf("http://localhost%s/_metrics", cfg.Server.MetricsPort)),
		)
		if err := http.ListenAndServe(cfg.Server.MetricsPort, nil); err != nil {
			logger.Log.Error("Metrics server error", zap.Error(err))
		}
	}()

	// 9. Start Server
	srv := apiserver.New(cfg, db, store, redisClient, meili)

	port := ":8081"
	logger.Log.Info("API Server starting", zap.String("port", port))

	if err := srv.Start(port); err != nil {
		logger.Log.Fatal("Server failed to start", zap.Error(err))
	}
}
