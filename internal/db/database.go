package database

import (
	"fmt"
	"log"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"momo-radio/internal/config"
	"momo-radio/internal/models"
)

type Client struct {
	DB *gorm.DB
}

func New(cfg *config.Config) *Client {
	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=UTC",
		cfg.Database.Host,
		cfg.Database.User,
		cfg.Database.Password,
		cfg.Database.Name,
		cfg.Database.Port,
	)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		log.Fatalf("❌ Failed to connect to database: %v", err)
	}

	// Connection Pool Settings
	sqlDB, _ := db.DB()
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)
	sqlDB.SetConnMaxLifetime(time.Hour)

	log.Println("✅ Database Connected")

	return &Client{DB: db}
}

// AutoMigrate creates/updates tables based on struct definitions
func (c *Client) AutoMigrate() {
	log.Println("Running Database Migrations...")
	err := c.DB.AutoMigrate(
		&models.PlayHistory{},
		&models.Playlist{},
		&models.PlaylistTrack{},
		&models.Schedule{},
		&models.ScheduleSlot{},
		&models.StreamState{},
		&models.Track{},
	)
	if err != nil {
		log.Fatalf("Migration failed: %v", err)
	}
	log.Println("✅ Migrations Complete")
}
