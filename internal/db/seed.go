package database

import (
	"log"
	"os"

	"momo-radio/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// SeedDatabase initializes the core multi-tenant requirements:
// 1. A default organization for orphaned/initial records.
// 2. An initial admin user linked to that organization (via Supabase UUID).
func SeedDatabase(db *gorm.DB) error {
	log.Println("Starting database seeding process...")

	// 1. Ensure the Default Organization exists
	// We use a deterministic UUID so it never duplicates on re-runs
	defaultOrgID := uuid.MustParse("00000000-0000-0000-0000-000000000001")

	defaultOrg := models.Organization{
		ID:   defaultOrgID,
		Name: "Momo Radio (Default Station)",
		Plan: "enterprise",
	}

	if err := db.FirstOrCreate(&defaultOrg, models.Organization{ID: defaultOrgID}).Error; err != nil {
		log.Printf("Failed to seed default organization: %v", err)
		return err
	}
	log.Println("Default Organization verified.")

	// 2. Check for a Superadmin UUID from the environment
	// This should be the UUID of your user in the Supabase Dashboard
	adminUUIDStr := os.Getenv("SUPERADMIN_UUID")
	if adminUUIDStr == "" {
		log.Println("No SUPERADMIN_UUID provided in environment. Skipping admin seed.")
		return nil
	}

	adminUUID, err := uuid.Parse(adminUUIDStr)
	if err != nil {
		log.Printf("Invalid SUPERADMIN_UUID format: %v", err)
		return err
	}

	adminEmail := os.Getenv("SUPERADMIN_EMAIL")
	if adminEmail == "" {
		adminEmail = "admin@momosbasement.com" // Fallback
	}

	// 3. Create the Local User Record (Identity managed by Supabase)
	adminUser := models.User{
		ID:    adminUUID,
		Email: adminEmail,
		Name:  "System Admin",
	}

	if err := db.FirstOrCreate(&adminUser, models.User{ID: adminUUID}).Error; err != nil {
		log.Printf("Failed to seed admin user: %v", err)
		return err
	}

	// 4. Link the Admin to the Default Organization with the 'owner' role
	orgUser := models.OrganizationUser{
		OrganizationID: defaultOrg.ID,
		UserID:         adminUser.ID,
		Role:           "owner",
	}

	if err := db.FirstOrCreate(&orgUser, orgUser).Error; err != nil {
		log.Printf("Failed to link admin to organization: %v", err)
		return err
	}

	log.Println("=====================================================")
	log.Printf("SYSTEM ADMIN GRANTED")
	log.Printf("   User Email: %s", adminEmail)
	log.Printf("   User UUID:  %s", adminUUIDStr)
	log.Printf("   Role:       owner")
	log.Println("=====================================================")

	return nil
}
