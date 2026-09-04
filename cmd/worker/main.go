package main

import (
	"crypto/tls"
	"flag"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/hibiken/asynq"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"

	"momo-radio/internal/config"
	database "momo-radio/internal/db"
	"momo-radio/internal/export"
	"momo-radio/internal/ingest"
	"momo-radio/internal/logger"
	"momo-radio/internal/search"
	"momo-radio/internal/storage"
)

type zapAsynqLogger struct {
	logger *zap.Logger
}

func (l *zapAsynqLogger) Debug(args ...interface{}) { l.logger.Sugar().Debug(args...) }
func (l *zapAsynqLogger) Info(args ...interface{})  { l.logger.Sugar().Info(args...) }
func (l *zapAsynqLogger) Warn(args ...interface{})  { l.logger.Sugar().Warn(args...) }
func (l *zapAsynqLogger) Error(args ...interface{}) { l.logger.Sugar().Error(args...) }
func (l *zapAsynqLogger) Fatal(args ...interface{}) { l.logger.Sugar().Fatal(args...) }

func main() {
	logger.Init()
	defer logger.Sync()

	// 1. Define Flags
	repairMeta := flag.Bool("repair-metadata", false, "Run metadata enrichment on existing tracks")
	repairAudio := flag.Bool("repair-audio", false, "Run Essentia analysis on tracks missing BPM/Key")
	repairCountry := flag.Bool("repair-country", false, "Run Discogs enrichment on existing tracks")
	dryRun := flag.Bool("dry-run", false, "Do not save changes to DB (use with repair flags)")
	repairProvider := flag.String("provider", "musicbrainz", "Metadata provider: 'musicbrainz' or 'discogs'")

	var targetArtists []string
	flag.Func("artists", "Comma-separated list of artists to target (e.g. -artists='Daft Punk,Justice')", func(s string) error {
		for a := range strings.SplitSeq(s, ",") {
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

	var tlsConfig *tls.Config
	if cfg.Redis.TLS {
		tlsConfig = &tls.Config{
			MinVersion: tls.VersionTLS12,
		}
		logger.Log.Info("Redis TLS Enabled (Upstash/Production mode)")
	} else {
		logger.Log.Info("Redis TLS Disabled (Local Development mode)")
	}

	redisClient := redis.NewClient(&redis.Options{
		Addr:      redisAddr,
		Password:  cfg.Redis.Password,
		DB:        cfg.Redis.DB,
		TLSConfig: tlsConfig,
		PoolSize:  cfg.Worker.RedisPoolSize,
	})

	redisOpt := asynq.RedisClientOpt{
		Addr:      redisAddr,
		Password:  cfg.Redis.Password,
		DB:        cfg.Redis.DB,
		TLSConfig: tlsConfig,
		PoolSize:  cfg.Worker.RedisPoolSize,
	}
	asynqClient := asynq.NewClient(redisOpt)
	defer asynqClient.Close()

	// 5. Run Database Migrations
	db.AutoMigrate()

	// Ensure temp directory exists
	if err := os.MkdirAll(cfg.Server.TempDir, 0755); err != nil {
		logger.Log.Fatal("Failed to create temp dir", zap.Error(err))
	}

	meiliClient := search.InitMeilisearch(cfg)

	// 6. Instantiate the Domain Workers
	ingestWorker := ingest.New(cfg, store, db, redisClient, asynqClient, meiliClient)
	exportWorker := export.New(cfg, store, db, redisClient)

	// 7. MODE SELECTION (CLI Maintenance)
	if *repairMeta || *repairAudio || *repairCountry {
		logger.Log.Info("MAINTENANCE MODE ACTIVE", zap.String("storage_provider", cfg.Storage.Provider))

		if *repairAudio {
			logger.Log.Info("Starting Audio Repair (Essentia)...")
			ingestWorker.RepairAudio()
		}

		if *repairMeta {
			logger.Log.Info("Starting Metadata Repair...")
			ingestWorker.RepairMetadata()
		}

		if *repairCountry {
			if *dryRun {
				logger.Log.Info("MODE: DRY RUN (No DB writes)")
			}
			logger.Log.Info("Starting Country Repair",
				zap.String("provider", *repairProvider),
				zap.Int("target_count", len(targetArtists)),
			)
			ingestWorker.RepairCountry(*dryRun, targetArtists, *repairProvider)
		}

		logger.Log.Info("All maintenance tasks finished. Exiting.")
		return
	}

	// 8. NORMAL OPERATION
	logger.Log.Info("Starting Unified Radio Worker", zap.String("storage_provider", cfg.Storage.Provider))

	// 9. Setup Metrics for ALL domains
	ingest.RegisterMetrics()
	export.RegisterMetrics()

	go func() {
		http.Handle("/metrics", promhttp.Handler())
		metricsURL := fmt.Sprintf("http://localhost%s/metrics", cfg.Server.MetricsPort)
		logger.Log.Info("Metrics exposed", zap.String("url", metricsURL))
		if err := http.ListenAndServe(cfg.Server.MetricsPort, nil); err != nil {
			logger.Log.Error("Metrics server failed", zap.Error(err))
		}
	}()

	// 10. Start the Unified Asynq Server
	srv := asynq.NewServer(
		asynq.RedisClientOpt{
			Addr:      redisAddr,
			Password:  cfg.Redis.Password,
			DB:        cfg.Redis.DB,
			TLSConfig: tlsConfig,
		},
		asynq.Config{
			Concurrency:              cfg.Worker.Concurrency,
			Queues:                   cfg.Worker.Queues,
			DelayedTaskCheckInterval: time.Duration(cfg.Worker.DelayedCheckIntervalSec) * time.Second,
			HealthCheckInterval:      time.Duration(cfg.Worker.HealthCheckIntervalSec) * time.Second,
			Logger:                   &zapAsynqLogger{logger: logger.Log},
		},
	)

	// Start the Asynq Scheduler for recurring tasks
	scheduler := asynq.NewScheduler(
		asynq.RedisClientOpt{
			Addr:      redisAddr,
			Password:  cfg.Redis.Password,
			DB:        cfg.Redis.DB,
			TLSConfig: tlsConfig,
		},
		&asynq.SchedulerOpts{
			Logger: &zapAsynqLogger{logger: logger.Log},
		},
	)

	// Register the sweeper job to run automatically every hour
	_, err := scheduler.Register(cfg.Worker.SweeperInterval, asynq.NewTask(ingest.TypeSweepOrphanedTracks, nil))
	if err != nil {
		logger.Log.Fatal("Failed to register sweeper task", zap.Error(err))
	}

	// Start the scheduler in a goroutine so it doesn't block the worker server
	go func() {
		if err := scheduler.Run(); err != nil {
			logger.Log.Error("Scheduler failed", zap.Error(err))
		}
	}()

	// 11. Wire the tasks to their respective handlers!
	mux := asynq.NewServeMux()
	mux.HandleFunc(ingest.TypeTrackProcess, ingestWorker.HandleProcessTask)
	mux.HandleFunc(ingest.TypeArtistEnrich, ingestWorker.HandleArtistEnrichTask)
	mux.HandleFunc(ingest.TypeTrackEnrich, ingestWorker.HandleTrackEnrichTask)
	mux.HandleFunc(export.TypeExportPlaylist, exportWorker.HandlePlaylistExportTask)
	mux.HandleFunc(ingest.TypeReindexCatalog, ingestWorker.HandleReindexCatalogTask)
	mux.HandleFunc(ingest.TypeSweepOrphanedTracks, ingestWorker.HandleSweepOrphanedTask)

	logger.Log.Info("Asynq Multiplexer listening for jobs...")
	if err := srv.Run(mux); err != nil {
		logger.Log.Fatal("Failed to start Asynq worker", zap.Error(err))
	}
}
