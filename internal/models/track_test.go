package models

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"github.com/stretchr/testify/assert"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"momo-radio/internal/testutils"
)

func setupTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	connStr := testutils.SetupPostgres(t)
	db, err := gorm.Open(postgres.Open(connStr), &gorm.Config{})
	assert.NoError(t, err)

	// Migrate just the models we are testing (no prefix)
	err = db.AutoMigrate(
		&Artist{},
		&Album{},
		&Track{},
		&PlayHistory{},
	)
	assert.NoError(t, err)

	return db
}

func TestCoreModelsIntegration(t *testing.T) {
	db := setupTestDB(t)
	orgID := uuid.New()

	t.Run("Create Full Graph", func(t *testing.T) {
		artist := Artist{
			OrganizationID: orgID,
			Name:           "Daft Punk",
			Type:           "Group",
			DiscogsID:      "123",
		}

		album := Album{
			OrganizationID: orgID,
			Title:          "Discovery",
			Year:           "2001",
		}

		track := Track{
			OrganizationID: orgID,
			Key:            "daft-punk-one-more-time",
			MasterKey:      "s3://bucket/one-more-time.wav",
			Title:          "One More Time",
			BPM:            123.0,
			MLMoods:        pq.StringArray{"energetic", "happy"},
			Artists:        []Artist{artist}, // GORM will create the artist and the join table entry
			Album:          album,            // GORM will create the album
		}

		// 1. Insert everything (fixed result.Error check)
		result := db.Create(&track)
		assert.NoError(t, result.Error)
		assert.Equal(t, int64(1), result.RowsAffected)
		assert.NotZero(t, track.ID)
		assert.NotZero(t, track.Artists[0].ID)
		assert.NotZero(t, track.Album.ID)

		// 2. Test PlayHistory
		history := PlayHistory{
			OrganizationID: orgID,
			TrackID:        track.ID,
			PlayedAt:       time.Now(),
		}
		err := db.Create(&history).Error
		assert.NoError(t, err)
	})

	t.Run("Unique Constraints", func(t *testing.T) {
		// Attempt to create another artist with the exact same name in the same org
		dupArtist := Artist{
			OrganizationID: orgID,
			Name:           "Daft Punk",
		}
		err := db.Create(&dupArtist).Error
		assert.Error(t, err, "expected unique constraint violation on artist name")
	})

	t.Run("Preload Data", func(t *testing.T) {
		var fetchedTrack Track

		// Fetch the track we created earlier and preload its relations
		err := db.Preload("Artists").
			Preload("Album").
			Where("title = ?", "One More Time").
			First(&fetchedTrack).Error

		assert.NoError(t, err)
		assert.Equal(t, "daft-punk-one-more-time", fetchedTrack.Key)
		assert.Equal(t, 123.0, fetchedTrack.BPM)

		// Verify slices and relations
		assert.Contains(t, fetchedTrack.MLMoods, "energetic")
		assert.Len(t, fetchedTrack.Artists, 1)
		assert.Equal(t, "Daft Punk", fetchedTrack.Artists[0].Name)
		assert.Equal(t, "Discovery", fetchedTrack.Album.Title)
	})
}
