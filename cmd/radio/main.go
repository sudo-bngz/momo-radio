package main

import (
	"context"
	"flag"
	"fmt"

	"github.com/redis/go-redis/v9"

	"momo-radio/internal/config"
	database "momo-radio/internal/db"
	"momo-radio/internal/logger"
	"momo-radio/internal/radio"
	"momo-radio/internal/storage"
)

func main() {
	logger.Init()
	defer logger.Sync()

	simulate := flag.Bool("simulate", false, "Dry run")
	flag.Parse()

	cfg := config.Load()
	if *simulate {
		cfg.Radio.DryRun = true
	}

	store := storage.New(cfg)
	db := database.New(cfg)
	db.AutoMigrate()

	redisAddr := fmt.Sprintf("%s:%s", cfg.Redis.Host, cfg.Redis.Port)
	rdb := redis.NewClient(&redis.Options{
		Addr:     redisAddr,
		Password: cfg.Redis.Password,
		DB:       cfg.Redis.DB,
	})

	logger.Log.Info("🚀 Starting Momo Radio Supervisor...")

	engine := radio.New(cfg, store, db, rdb)

	// Instead of a single Run(), we start the supervisor daemon
	ctx := context.Background()
	engine.StartSupervisor(ctx)
}
