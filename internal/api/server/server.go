package server

import (
	"io"
	"io/fs"
	"net/http"
	"strings"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"momo-radio/gui" // Imports your embedded filesystem
	"momo-radio/internal/api/handlers"
	"momo-radio/internal/api/middleware"
	"momo-radio/internal/config"
	database "momo-radio/internal/db"
	"momo-radio/internal/storage"
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
	//s.router.Use(middleware.SilentLogger())
}

func (s *Server) setupRoutes() {
	// 1. Initialize Modular Handlers
	authHandler := handlers.NewAuthHandler(s.db.DB)
	statsHandler := handlers.NewStatsHandler(s.db.DB)
	trackHandler := handlers.NewTrackHandler(s.db.DB, s.storage)
	playlistHandler := handlers.NewPlaylistHandler(s.db.DB)
	schedulerHandler := handlers.NewSchedulerHandler(s.db.DB, s.cfg)

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
			protected.POST("/auth/register", middleware.RequireRole("admin"), authHandler.Register)

			// --- TRACK
			protected.GET("/tracks", middleware.RequireRole("dj", "manager"), trackHandler.GetTracks)
			protected.GET("/tracks/:id", middleware.RequireRole("dj", "manager"), trackHandler.GetTrack)
			protected.GET("/tracks/:id/stream", middleware.RequireRole("dj", "manager"), trackHandler.StreamTrack)
			protected.PUT("/tracks/:id", middleware.RequireRole("dj", "manager"), trackHandler.UpdateTrack)

			// --- DJ & MANAGER (Curators) ---
			protected.POST("/upload/analyze", middleware.RequireRole("dj", "manager"), trackHandler.PreAnalyzeFile)
			protected.POST("/upload/confirm", middleware.RequireRole("dj", "manager"), trackHandler.UploadTrack)

			// --- PLAYLIST
			protected.GET("/playlists", middleware.RequireRole("dj", "manager"), playlistHandler.GetPlaylists)
			protected.GET("/playlists/:id", middleware.RequireRole("dj", "manager"), playlistHandler.GetPlaylist)
			protected.POST("/playlists", middleware.RequireRole("dj", "manager"), playlistHandler.CreatePlaylist)
			protected.DELETE("/playlists/:id", middleware.RequireRole("dj", "manager"), playlistHandler.DeletePlaylist)
			protected.PUT("/playlists/:id", middleware.RequireRole("dj", "manager"), playlistHandler.UpdatePlaylist)
			protected.PUT("/playlists/:id/tracks", middleware.RequireRole("dj", "manager"), playlistHandler.UpdatePlaylistTracks)

			// --- MANAGER ONLY (Program Directors) ---
			protected.GET("/schedules", middleware.RequireRole("dj"), schedulerHandler.GetSchedule)
			protected.POST("/schedules", middleware.RequireRole("manager"), schedulerHandler.CreateScheduleSlot)
			protected.DELETE("/schedules/:id", middleware.RequireRole("manager"), schedulerHandler.DeleteScheduleSlot)
		}
	}

	// ==========================================
	// EMBEDDED REACT UI (SPA Fallback)
	// ==========================================

	// Extract the "dist" folder from the embedded filesystem
	distFS, err := fs.Sub(gui.DistFS, "dist")
	if err != nil {
		panic("Failed to load embedded frontend: " + err.Error())
	}

	s.router.NoRoute(func(c *gin.Context) {
		path := c.Request.URL.Path

		// 1. If it's an API route that wasn't found, return a 404 JSON response
		if strings.HasPrefix(path, "/api") {
			c.JSON(http.StatusNotFound, gin.H{"error": "API endpoint not found"})
			return
		}

		// 2. Check if the requested file exists in the embedded React dist folder
		cleanPath := strings.TrimPrefix(path, "/")
		if cleanPath == "" {
			cleanPath = "index.html"
		}

		file, err := distFS.Open(cleanPath)
		if err == nil {
			defer file.Close()
			stat, _ := file.Stat()

			// If it's a file (like /assets/main.js), serve it directly
			if !stat.IsDir() {
				http.ServeContent(c.Writer, c.Request, stat.Name(), stat.ModTime(), file.(io.ReadSeeker))
				return
			}
		}

		// 3. If the file doesn't exist, it's a React Router path (e.g., "/library"). Serve index.html.
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

// Start runs the server on the configured port
func (s *Server) Start(addr string) error {
	return s.router.Run(addr)
}
