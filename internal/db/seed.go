package database

import (
	"log"
	"momo-radio/internal/models"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// SeedAdminUser initializes the RBAC system by creating a default admin
// if no admin users currently exist in the database.
func SeedAdminUser(db *gorm.DB) error {
	var count int64

	// 1. Check if an admin already exists
	db.Model(&models.Users{}).Where("role = ?", "admin").Count(&count)
	if count > 0 {
		log.Println("✅ Admin user already exists. Skipping RBAC seed.")
		return nil
	}

	log.Println("🌱 Seeding default Admin user...")

	// 2. Define default credentials
	// IMPORTANT: Change this password immediately via the UI once built!
	defaultUsername := "admin"
	defaultPassword := "admin"

	// 3. Hash the password securely
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(defaultPassword), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("❌ Failed to hash default admin password: %v", err)
		return err
	}

	// 4. Create the User struct
	adminUser := models.Users{
		Username:     defaultUsername,
		PasswordHash: string(hashedPassword),
		Role:         "admin", // The master key role
	}

	// 5. Insert into the database
	if err := db.Create(&adminUser).Error; err != nil {
		log.Printf("❌ Failed to create admin user: %v", err)
		return err
	}

	// 6. Print giant warning to the console
	log.Println("=====================================================")
	log.Printf("🚨 ADMIN CREATED")
	log.Printf("   Username: %s", defaultUsername)
	log.Printf("   Password: %s", defaultPassword)
	log.Println("⚠️  PLEASE CHANGE THIS PASSWORD IMMEDIATELY!")
	log.Println("=====================================================")

	return nil
}
