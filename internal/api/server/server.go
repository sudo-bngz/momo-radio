package server

import (
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"strings"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/hibiken/asynq"
	"github.com/redis/go-redis/v9"

	"momo-radio/gui"
	"momo-radio/internal/api/handlers"
	"momo-radio/internal/api/middleware"
	"momo-radio/internal/config"
	database "momo-radio/internal/db"
	"momo-radio/internal/storage"
)

type Server struct {
	cfg         *config.Config
	db          *database.Client
	storage     *storage.Client
	redis       *redis.Client
	asynqClient *asynq.Client
	router      *gin.Engine
}

func New(cfg *config.Config, db *database.Client, storage *storage.Client, redisClient *redis.Client) *Server {
	if cfg.Radio.LogLevel != "debug" {
		gin.SetMode(gin.ReleaseMode)
	}

	redisOpt := asynq.RedisClientOpt{
		Addr:     fmt.Sprintf("%s:%s", cfg.Redis.Host, cfg.Redis.Port),
		Password: cfg.Redis.Password,
		DB:       cfg.Redis.DB,
	}
	asynqClient := asynq.NewClient(redisOpt)

	s := &Server{
		cfg:         cfg,
		db:          db,
		storage:     storage,
		redis:       redisClient,
		asynqClient: asynqClient,
		router:      gin.Default(),
	}

	s.setupMiddleware()
	s.setupRoutes()

	return s
}

func (s *Server) Close() {
	if s.asynqClient != nil {
		s.asynqClient.Close()
	}
}

func (s *Server) setupMiddleware() {
	corsConfig := cors.DefaultConfig()
	corsConfig.AllowAllOrigins = true
	corsConfig.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
	corsConfig.AllowHeaders = []string{"Origin", "Content-Length", "Content-Type", "Authorization", "X-Organization-Id"}

	s.router.Use(cors.New(corsConfig))
}

func (s *Server) setupRoutes() {
	authHandler := handlers.NewAuthHandler(s.db.DB)
	statsHandler := handlers.NewStatsHandler(s.db.DB)
	trackHandler := handlers.NewTrackHandler(s.db.DB, s.storage, s.cfg, s.redis)
	playlistHandler := handlers.NewPlaylistHandler(s.db.DB, s.storage)
	schedulerHandler := handlers.NewSchedulerHandler(s.db.DB, s.cfg)
	artistHandler := handlers.NewArtistHandler(s.db.DB, s.storage)
	albumHandler := handlers.NewAlbumHandler(s.db.DB, s.storage)
	exportHandler := handlers.NewExportHandler(s.asynqClient)

	s.router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "service": "momo-radio"})
	})

	// ==========================================
	// INTERNAL ROUTES (Machine-to-Machine / RTMP)
	// ==========================================
	internal := s.router.Group("/api/internal")
	{
		// This endpoint will be called by Nginx-RTMP or SRT to validate the stream key
		// e.g. handlers.AuthStreamPublish must be defined in stream.go
		internal.POST("/auth-publish", handlers.AuthStreamPublish(s.db.DB))
	}

	// ==========================================
	// API Group
	// ==========================================
	v1 := s.router.Group("/api/v1")
	{
		jwtOnly := v1.Group("/")
		jwtOnly.Use(middleware.RequireValidJWT(s.cfg.Supabase.JWTPublicKey))
		{
			jwtOnly.GET("/auth/me", authHandler.GetMe)
		}

		v1.POST("/webhooks/supabase", authHandler.HandleSupabaseWebhook)

		protected := v1.Group("/")
		{
			// --- STATS ---
			protected.GET("/stats", middleware.RequireSupabaseAuth(s.db.DB, s.cfg.Supabase.JWTPublicKey, "owner", "admin", "editor", "viewer"), statsHandler.GetStats)

			// --- TRACKS ---
			protected.GET("/tracks", middleware.RequireSupabaseAuth(s.db.DB, s.cfg.Supabase.JWTPublicKey, "owner", "admin", "editor", "viewer"), trackHandler.GetTracks)
			protected.GET("/tracks/:id", middleware.RequireSupabaseAuth(s.db.DB, s.cfg.Supabase.JWTPublicKey, "owner", "admin", "editor", "viewer"), trackHandler.GetTrack)
			protected.GET("/tracks/:id/stream", middleware.RequireSupabaseAuth(s.db.DB, s.cfg.Supabase.JWTPublicKey, "owner", "admin", "editor", "viewer"), trackHandler.StreamTrack)
			protected.GET("/tracks/:id/status-stream", middleware.RequireSupabaseAuth(s.db.DB, s.cfg.Supabase.JWTPublicKey, "owner", "admin", "editor", "viewer"), trackHandler.TrackStatusStream)
			protected.PUT("/tracks/:id", middleware.RequireSupabaseAuth(s.db.DB, s.cfg.Supabase.JWTPublicKey, "owner", "admin", "editor"), trackHandler.UpdateTrack)
			protected.GET("/tracks/queue", middleware.RequireSupabaseAuth(s.db.DB, s.cfg.Supabase.JWTPublicKey, "owner", "admin", "editor", "viewer"), trackHandler.GetQueue)
			protected.POST("/tracks/:id/analysis", middleware.RequireSupabaseAuth(s.db.DB, s.cfg.Supabase.JWTPublicKey, "owner", "admin", "editor"), trackHandler.Analysis)

			// --- UPLOAD / CURATION ---
			protected.POST("/upload/analyze", middleware.RequireSupabaseAuth(s.db.DB, s.cfg.Supabase.JWTPublicKey, "owner", "admin", "editor"), trackHandler.PreAnalyzeFile)
			protected.POST("/upload/confirm", middleware.RequireSupabaseAuth(s.db.DB, s.cfg.Supabase.JWTPublicKey, "owner", "admin", "editor"), trackHandler.UploadTrack)

			// --- ARTISTS & ALBUMS ---
			protected.GET("/artists", middleware.RequireSupabaseAuth(s.db.DB, s.cfg.Supabase.JWTPublicKey, "owner", "admin", "editor", "viewer"), artistHandler.GetArtists)
			protected.GET("/artists/:id", middleware.RequireSupabaseAuth(s.db.DB, s.cfg.Supabase.JWTPublicKey, "owner", "admin", "editor", "viewer"), artistHandler.GetArtistByID)
			protected.GET("/albums", middleware.RequireSupabaseAuth(s.db.DB, s.cfg.Supabase.JWTPublicKey, "owner", "admin", "editor", "viewer"), albumHandler.GetAlbums)
			protected.GET("/albums/:id", middleware.RequireSupabaseAuth(s.db.DB, s.cfg.Supabase.JWTPublicKey, "owner", "admin", "editor", "viewer"), albumHandler.GetAlbumByID)

			// --- PLAYLISTS ---
			protected.GET("/playlists", middleware.RequireSupabaseAuth(s.db.DB, s.cfg.Supabase.JWTPublicKey, "owner", "admin", "editor", "viewer"), playlistHandler.GetPlaylists)
			protected.GET("/playlists/:id", middleware.RequireSupabaseAuth(s.db.DB, s.cfg.Supabase.JWTPublicKey, "owner", "admin", "editor", "viewer"), playlistHandler.GetPlaylist)
			protected.POST("/playlists", middleware.RequireSupabaseAuth(s.db.DB, s.cfg.Supabase.JWTPublicKey, "owner", "admin", "editor"), playlistHandler.CreatePlaylist)
			protected.DELETE("/playlists/:id", middleware.RequireSupabaseAuth(s.db.DB, s.cfg.Supabase.JWTPublicKey, "owner", "admin", "editor"), playlistHandler.DeletePlaylist)
			protected.PUT("/playlists/:id", middleware.RequireSupabaseAuth(s.db.DB, s.cfg.Supabase.JWTPublicKey, "owner", "admin", "editor"), playlistHandler.UpdatePlaylist)
			protected.PUT("/playlists/:id/tracks", middleware.RequireSupabaseAuth(s.db.DB, s.cfg.Supabase.JWTPublicKey, "owner", "admin", "editor"), playlistHandler.UpdatePlaylistTracks)
			protected.POST("/playlists/:id/export/rekordbox", middleware.RequireSupabaseAuth(s.db.DB, s.cfg.Supabase.JWTPublicKey, "owner", "admin", "editor", "viewer"), exportHandler.ExportToM3u)

			// --- SCHEDULING ---
			protected.GET("/schedules", middleware.RequireSupabaseAuth(s.db.DB, s.cfg.Supabase.JWTPublicKey, "owner", "admin", "editor", "viewer"), schedulerHandler.GetSchedule)
			protected.POST("/schedules", middleware.RequireSupabaseAuth(s.db.DB, s.cfg.Supabase.JWTPublicKey, "owner", "admin"), schedulerHandler.CreateScheduleSlot)
			protected.DELETE("/schedules/:id", middleware.RequireSupabaseAuth(s.db.DB, s.cfg.Supabase.JWTPublicKey, "owner", "admin"), schedulerHandler.DeleteScheduleSlot)

			// ⚡️ --- BROADCAST & MOUNT POINTS ---
			protected.GET("/mounts", middleware.RequireSupabaseAuth(s.db.DB, s.cfg.Supabase.JWTPublicKey, "owner", "admin", "editor", "dj", "viewer"), handlers.GetMountPoints(s.db.DB))
		}
	}

	// ==========================================
	// EMBEDDED REACT UI (SPA Fallback)
	// ==========================================
	distFS, err := fs.Sub(gui.DistFS, "dist")
	if err != nil {
		panic("Failed to load embedded frontend: " + err.Error())
	}

	s.router.NoRoute(func(c *gin.Context) {
		path := c.Request.URL.Path

		if strings.HasPrefix(path, "/api") {
			c.JSON(http.StatusNotFound, gin.H{"error": "API endpoint not found"})
			return
		}

		cleanPath := strings.TrimPrefix(path, "/")
		if cleanPath == "" {
			cleanPath = "index.html"
		}

		file, err := distFS.Open(cleanPath)
		if err == nil {
			defer file.Close()
			stat, _ := file.Stat()
			if !stat.IsDir() {
				http.ServeContent(c.Writer, c.Request, stat.Name(), stat.ModTime(), file.(io.ReadSeeker))
				return
			}
		}

		indexFile, err := distFS.Open("index.html")
		if err != nil {
			c.String(http.StatusInternalServerError, "Frontend not built properly (index.html missing)")
			return
		}
		defer indexFile.Close()

		stat, _ := indexFile.Stat()
		http.ServeContent(c.Writer, c.Request, stat.Name(), stat.ModTime(), indexFile.(io.ReadSeeker))
	})
}

func (s *Server) Start(addr string) error {
	return s.router.Run(addr)
}
