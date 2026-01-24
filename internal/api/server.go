package api

import (
	"net/http"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

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
		gin.SetMode(gin.TestMode)
	}

	s := &Server{
		cfg:     cfg,
		db:      db,
		storage: storage, // Assign it
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
	corsConfig.AllowMethods = []string{"GET", "POST", "PUT", "OPTIONS"}
	corsConfig.AllowHeaders = []string{"Origin", "Content-Length", "Content-Type", "Authorization"}

	s.router.Use(cors.New(corsConfig))
}

func (s *Server) setupRoutes() {
	// Health Check
	s.router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "service": "momo-radio"})
	})

	// API Group
	v1 := s.router.Group("/api/v1")
	{
		v1.GET("/tracks", s.GetTracks)
		v1.GET("/stats", s.GetStats)

		// Upload Workflow
		v1.POST("/upload/analyze", s.PreAnalyzeFile)
		v1.POST("/upload/confirm", s.UploadTrack)
	}
}

// Start runs the server on the configured port
func (s *Server) Start(addr string) error {
	return s.router.Run(addr)
}
