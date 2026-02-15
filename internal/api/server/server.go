package server

import (
	"net/http"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"momo-radio/internal/config"
	database "momo-radio/internal/db"
	"momo-radio/internal/storage"

	"momo-radio/internal/api/handlers"
	"momo-radio/internal/api/middleware"
)

type Server struct {
	cfg     *config.Config
	db      *database.Client
	storage *storage.Client
	router  *gin.Engine
}

func New(cfg *config.Config, db *database.Client, storage *storage.Client) *Server {
	if cfg.Radio.LogLevel != "debug" {
		gin.SetMode(gin.ReleaseMode) // Set to Release for production
	}

	s := &Server{
		cfg:     cfg,
		db:      db,
		storage: storage,
		router:  gin.Default(),
	}

	s.setupMiddleware()
	s.setupRoutes()

	return s
}

func (s *Server) setupMiddleware() {
	// CORS Configuration
	corsConfig := cors.DefaultConfig()
	corsConfig.AllowAllOrigins = true
	corsConfig.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}

	// IMPORTANT: "Authorization" must be allowed so the frontend can send the JWT
	corsConfig.AllowHeaders = []string{"Origin", "Content-Length", "Content-Type", "Authorization"}

	s.router.Use(cors.New(corsConfig))
}

func (s *Server) setupRoutes() {
	// 1. Initialize Modular Handlers
	authHandler := handlers.NewAuthHandler(s.db.DB)
	statsHandler := handlers.NewStatsHandler(s.db.DB)
	trackHandler := handlers.NewTrackHandler(s.db.DB, s.storage)
	playlistHandler := handlers.NewPlaylistHandler(s.db.DB)
	schedulerHandler := handlers.NewSchedulerHandler(s.db.DB)

	// Health Check
	s.router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "service": "momo-radio"})
	})

	// API Group
	v1 := s.router.Group("/api/v1")
	{
		// ==========================================
		// PUBLIC ROUTES (No Token Required)
		// ==========================================
		v1.POST("/auth/login", authHandler.Login)

		v1.GET("/stats", statsHandler.GetStats)

		// ==========================================
		// PROTECTED ROUTES (JWT Token Required)
		// ==========================================
		protected := v1.Group("/")
		protected.Use(middleware.RequireAuth()) // Checks for valid JWT
		{
			// --- ADMIN ONLY ---
			// Only Admins can register new staff/users to the station.
			protected.POST("/auth/register", middleware.RequireRole("admin"), authHandler.Register)

			// --- TRACK
			protected.GET("/tracks", middleware.RequireRole("dj", "manager"), trackHandler.GetTracks)

			// --- DJ & MANAGER (Content Creators) ---
			// DJs and Managers can upload music and manage playlists.
			protected.POST("/upload/analyze", middleware.RequireRole("dj", "manager"), trackHandler.PreAnalyzeFile)
			protected.POST("/upload/confirm", middleware.RequireRole("dj", "manager"), trackHandler.UploadTrack)

			// --- PLAYLIST
			protected.GET("/playlists", middleware.RequireRole("dj", "manager"), playlistHandler.GetPlaylists)
			protected.GET("/playlists/:id", middleware.RequireRole("dj", "manager"), playlistHandler.GetPlaylist) // For fetching one to edit
			protected.POST("/playlists", middleware.RequireRole("dj", "manager"), playlistHandler.CreatePlaylist)
			protected.DELETE("/playlists/:id", middleware.RequireRole("dj", "manager"), playlistHandler.DeletePlaylist) // For deleting
			protected.PUT("/playlists/:id/tracks", middleware.RequireRole("dj", "manager"), playlistHandler.UpdatePlaylistTracks)

			// --- MANAGER ONLY (Program Directors) ---
			// Only Managers (and Admins) can change the station's broadcast schedule.
			protected.POST("/schedule", middleware.RequireRole("manager"), schedulerHandler.CreateScheduleSlot)
			protected.DELETE("/schedule/:id", middleware.RequireRole("manager"), schedulerHandler.DeleteScheduleSlot)
		}
	}
}

// Start runs the server on the configured port
func (s *Server) Start(addr string) error {
	return s.router.Run(addr)
}
