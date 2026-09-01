package models

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"momo-radio/internal/testutils"
)

func setupPublicPageTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	connStr := testutils.SetupPostgres(t)
	db, err := gorm.Open(postgres.Open(connStr), &gorm.Config{})
	assert.NoError(t, err)

	// Migrate just the PublicPage model
	err = db.AutoMigrate(&PublicPage{})
	assert.NoError(t, err)

	return db
}

func TestPublicPageIntegration(t *testing.T) {
	db := setupPublicPageTestDB(t)

	orgID1 := uuid.New()
	orgID2 := uuid.New()
	testSlug := "concrete-underground"

	t.Run("Create Public Page", func(t *testing.T) {
		page := PublicPage{
			OrganizationID: orgID1,
			Slug:           testSlug,
			ThemeMode:      "light",
			AccentColor:    "#ff0055",
			VisualMode:     "custom",
			HydraCode:      "osc(4, 0.1, 1.2).out()",
		}

		// 1. Insert the page
		err := db.Create(&page).Error
		assert.NoError(t, err)

		// 2. Fetch it back to verify
		var fetched PublicPage
		err = db.First(&fetched, "organization_id = ?", orgID1).Error
		assert.NoError(t, err)

		assert.Equal(t, testSlug, fetched.Slug)
		assert.Equal(t, "#ff0055", fetched.AccentColor)
		assert.Equal(t, "custom", fetched.VisualMode)
		assert.Equal(t, "osc(4, 0.1, 1.2).out()", fetched.HydraCode)
	})

	t.Run("Unique Slug Constraint", func(t *testing.T) {
		// Attempt to create a page for a DIFFERENT organization but using the SAME slug
		dupPage := PublicPage{
			OrganizationID: orgID2,
			Slug:           testSlug,
		}

		err := db.Create(&dupPage).Error
		assert.Error(t, err, "expected unique constraint violation on slug")
	})
}
