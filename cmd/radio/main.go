package main

import (
	"context"
	"flag"
	"fmt"
	"log"

	"momo-radio/internal/config"
	database "momo-radio/internal/db"
	"momo-radio/internal/radio"
	"momo-radio/internal/storage"

	"github.com/redis/go-redis/v9"
)

func main() {
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

	log.Println("🚀 Starting Momo Radio Supervisor...")

	engine := radio.New(cfg, store, db, rdb)

	// Instead of a single Run(), we start the supervisor daemon
	ctx := context.Background()
	engine.StartSupervisor(ctx)
}
