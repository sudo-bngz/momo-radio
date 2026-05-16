package main

import (
	"log"
	"strings"

	"momo-radio/internal/config"
	database "momo-radio/internal/db"
	"momo-radio/internal/models"

	"github.com/google/uuid"
)

func main() {
	cfg := config.Load()
	dbClient := database.New(cfg)
	db := dbClient.DB

	log.Println("🚀 Starting Data Migration (Many-to-Many Pass)...")

	// 1. AutoMigrate will automatically build the new album_artists and track_artists join tables
	db.AutoMigrate(&models.Artist{}, &models.Album{}, &models.Track{})

	// 2. THE DATA TRANSFER
	type LegacyTrack struct {
		ID             uint
		OrganizationID uuid.UUID // ⚡️ Required to scope entities properly
		Artist         string
		ArtistCountry  string
		Album          string
		Year           string
		Publisher      string
		CatalogNumber  string
		ReleaseCountry string
	}

	var legacyTracks []LegacyTrack
	// Fetch legacy data (ensure organization_id is included!)
	db.Raw("SELECT id, organization_id, artist, artist_country, album, year, publisher, catalog_number, release_country FROM tracks").Scan(&legacyTracks)

	log.Printf("Step 3: Processing %d tracks to populate extended metadata...", len(legacyTracks))

	for _, lt := range legacyTracks {
		rawArtist := strings.TrimSpace(lt.Artist)
		if rawArtist == "" {
			rawArtist = "Unknown Artist"
		}

		// A. Split and Resolve Multiple Artists
		artistNames := strings.Split(rawArtist, ",")
		var resolvedArtists []models.Artist

		for _, name := range artistNames {
			cleanName := strings.TrimSpace(name)
			if cleanName == "" {
				continue
			}

			var artist models.Artist
			db.Where(models.Artist{Name: cleanName, OrganizationID: lt.OrganizationID}).
				FirstOrCreate(&artist, models.Artist{Name: cleanName, OrganizationID: lt.OrganizationID})

			// Safely update Artist Country
			if artist.ArtistCountry == "" && lt.ArtistCountry != "" {
				db.Model(&artist).Update("artist_country", lt.ArtistCountry)
			}
			resolvedArtists = append(resolvedArtists, artist)
		}

		// B. Find or Create the Album
		var albumID *uint
		if lt.Album != "" {
			var album models.Album
			// Match on Title + Org (No ArtistID)
			db.Where(models.Album{Title: lt.Album, OrganizationID: lt.OrganizationID}).
				FirstOrCreate(&album, models.Album{Title: lt.Album, OrganizationID: lt.OrganizationID})

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

			// ⚡️ Append Artists to the Album's Many-to-Many relation
			db.Model(&album).Association("Artists").Append(resolvedArtists)

			albumID = &album.ID
		}

		// C. Link Everything to the Track
		var track models.Track
		if err := db.First(&track, lt.ID).Error; err == nil {
			// ⚡️ Append Artists to Track Many-to-Many
			db.Model(&track).Association("Artists").Append(resolvedArtists)

			// ⚡️ Set the Album ID
			db.Model(&track).Update("album_id", albumID)
		}
	}

	// 4. CLEANUP (Optional but recommended)
	log.Println("Step 4: Cleaning up legacy columns...")
	// These drop the old singular artist_id columns so your schema matches your Go structs perfectly
	db.Exec("ALTER TABLE tracks DROP COLUMN IF EXISTS artist_id")
	db.Exec("ALTER TABLE albums DROP COLUMN IF EXISTS artist_id")

	log.Println("✨ Metadata Migration Successful! All fields are now using Many-to-Many relations.")
}
