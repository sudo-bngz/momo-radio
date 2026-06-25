package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"momo-radio/internal/models"
)

type ProfileHandler struct {
	db *gorm.DB
}

func NewProfileHandler(db *gorm.DB) *ProfileHandler {
	return &ProfileHandler{db: db}
}

// GetProfile fetches the user's local profile
func (h *ProfileHandler) GetProfile(c *gin.Context) {
	userIDStr := c.GetString("userID")
	if userIDStr == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	parsedUserID, _ := uuid.Parse(userIDStr)

	var profile models.UserProfile
	// FirstOrCreate ensures a profile row exists for them
	if err := h.db.FirstOrCreate(&profile, models.UserProfile{ID: parsedUserID}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load profile"})
		return
	}

	c.JSON(http.StatusOK, profile)
}

// UpdateProfile saves local profile changes
func (h *ProfileHandler) UpdateProfile(c *gin.Context) {
	userIDStr := c.GetString("userID")
	if userIDStr == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	parsedUserID, _ := uuid.Parse(userIDStr)

	var req struct {
		FirstName string `json:"first_name"`
		LastName  string `json:"last_name"`
		AvatarURL string `json:"avatar_url"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
		return
	}

	// Update only the specific fields in the database
	updates := map[string]interface{}{
		"first_name": req.FirstName,
		"last_name":  req.LastName,
		"avatar_url": req.AvatarURL,
		"updated_at": time.Now(),
	}

	if err := h.db.Model(&models.UserProfile{}).Where("id = ?", parsedUserID).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update profile"})
		return
	}

	// Return the updated profile
	var updatedProfile models.UserProfile
	h.db.First(&updatedProfile, parsedUserID)

	c.JSON(http.StatusOK, updatedProfile)
}
