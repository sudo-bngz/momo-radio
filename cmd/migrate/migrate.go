package main

import (
	"log"
	"momo-radio/internal/config"
	database "momo-radio/internal/db"
	"momo-radio/internal/models"
)

func main() {
	cfg := config.Load()
	dbClient := database.New(cfg)
	db := dbClient.DB

	log.Println("🚀 Starting Data Migration (Metadata Pass)...")

	// 1. Ensure columns and tables exist
	db.Exec("ALTER TABLE tracks ADD COLUMN IF NOT EXISTS artist_id bigint")
	db.Exec("ALTER TABLE tracks ADD COLUMN IF NOT EXISTS album_id bigint")
	db.AutoMigrate(&models.Artist{}, &models.Album{})

	// 2. THE DATA TRANSFER (Fixed to include ALL metadata)
	type LegacyTrack struct {
		ID             uint
		Artist         string
		ArtistCountry  string
		Album          string
		Year           string
		Publisher      string
		CatalogNumber  string
		ReleaseCountry string
	}

	var legacyTracks []LegacyTrack
	// ⚡️ FIXED: Selecting all the extended metadata fields
	db.Raw("SELECT id, artist, artist_country, album, year, publisher, catalog_number, release_country FROM tracks").Scan(&legacyTracks)

	log.Printf("Step 3: Processing %d tracks to populate extended metadata...", len(legacyTracks))

	for _, lt := range legacyTracks {
		if lt.Artist == "" {
			lt.Artist = "Unknown Artist"
		}

		// A. Find or Create the Artist
		var artist models.Artist
		db.Where(models.Artist{Name: lt.Artist}).FirstOrCreate(&artist)

		// ⚡️ Safely update Artist Country (only if it's currently empty and we have new data)
		if artist.ArtistCountry == "" && lt.ArtistCountry != "" {
			db.Model(&artist).Update("artist_country", lt.ArtistCountry)
		}

		// B. Find or Create the Album (if it exists)
		var albumID *uint
		if lt.Album != "" {
			var album models.Album
			db.Where(models.Album{Title: lt.Album, ArtistID: artist.ID}).FirstOrCreate(&album)

			// ⚡️ Safely update Album metadata
			albumUpdates := map[string]interface{}{}
			if album.Year == "" && lt.Year != "" {
				albumUpdates["year"] = lt.Year
			}
			if album.Publisher == "" && lt.Publisher != "" {
				albumUpdates["publisher"] = lt.Publisher
			}
			if album.CatalogNumber == "" && lt.CatalogNumber != "" {
				albumUpdates["catalog_number"] = lt.CatalogNumber
			}
			if album.ReleaseCountry == "" && lt.ReleaseCountry != "" {
				albumUpdates["release_country"] = lt.ReleaseCountry
			}

			if len(albumUpdates) > 0 {
				db.Model(&album).Updates(albumUpdates)
			}

			albumID = &album.ID
		}

		// C. Ensure the Track is linked
		db.Table("tracks").Where("id = ?", lt.ID).Updates(map[string]interface{}{
			"artist_id": artist.ID,
			"album_id":  albumID,
		})
	}

	// 4. Finalize the constraints
	log.Println("Step 4: Enforcing NOT NULL constraints...")
	db.Exec("ALTER TABLE tracks ALTER COLUMN artist_id SET NOT NULL")

	log.Println("✨ Metadata Migration Successful! All fields are now populated.")
}
