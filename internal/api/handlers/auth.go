package handlers

import (
	"net/http"
	"strings"

	"momo-radio/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type AuthHandler struct {
	db *gorm.DB
}

func NewAuthHandler(db *gorm.DB) *AuthHandler {
	return &AuthHandler{db: db}
}

// ----------------------------------------------------------------------------
// 1. SUPABASE WEBHOOK HANDLER
// Route: POST /api/webhooks/supabase
// Called automatically by Supabase when a new user registers.
// ----------------------------------------------------------------------------

type SupabaseWebhookPayload struct {
	Type   string `json:"type"`
	Record struct {
		ID    string `json:"id"`
		Email string `json:"email"`
		// Supabase stores social login names in raw_user_meta_data
		RawUserMetaData struct {
			Name     string `json:"name"`
			FullName string `json:"full_name"`
		} `json:"raw_user_meta_data"`
	} `json:"record"`
}

func (h *AuthHandler) HandleSupabaseWebhook(c *gin.Context) {
	var payload SupabaseWebhookPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid webhook payload"})
		return
	}

	// Only process INSERT events (new signups)
	if payload.Type != "INSERT" {
		c.JSON(http.StatusOK, gin.H{"message": "Ignored non-insert event"})
		return
	}

	userID, err := uuid.Parse(payload.Record.ID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user UUID"})
		return
	}

	name := payload.Record.RawUserMetaData.Name
	if name == "" {
		name = payload.Record.RawUserMetaData.FullName
	}

	// Use a database transaction to ensure both user and org are created safely
	err = h.db.Transaction(func(tx *gorm.DB) error {
		// 1. Create the Local User
		user := models.User{
			ID:    userID,
			Email: payload.Record.Email,
			Name:  name,
		}
		if err := tx.Create(&user).Error; err != nil {
			return err
		}

		// 2. Create a default Personal Organization for them
		org := models.Organization{
			Name: user.Name + "'s Station",
			Plan: "free",
		}
		if err := tx.Create(&org).Error; err != nil {
			return err
		}

		// 3. Make them the Owner of their new Organization
		orgUser := models.OrganizationUser{
			OrganizationID: org.ID,
			UserID:         user.ID,
			Role:           "owner",
		}
		if err := tx.Create(&orgUser).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to provision user resources"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "User and Organization provisioned successfully"})
}

// ----------------------------------------------------------------------------
// FETCH CURRENT USER CONTEXT & JIT PROVISIONING
// Route: GET /api/v1/auth/me
// Protected by the Supabase JWT Middleware (NOT the Organization Middleware)
// ----------------------------------------------------------------------------

func (h *AuthHandler) GetMe(c *gin.Context) {
	// Extract the UserID and Email injected by your JWT Middleware
	userIDStr := c.GetString("userID")
	emailStr := c.GetString("email") // Ensure your middleware sets this!

	if userIDStr == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User context not found"})
		return
	}

	var user models.User

	// 1. Try to find the user and their organizations
	err := h.db.Preload("Organizations.Organization").Where("id = ?", userIDStr).First(&user).Error

	// 2. If the user DOES NOT exist, trigger Just-In-Time Provisioning
	if err != nil {
		if err == gorm.ErrRecordNotFound {

			userID, parseErr := uuid.Parse(userIDStr)
			if parseErr != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user UUID format"})
				return
			}

			// Generate a friendly default name from their email prefix
			name := "New User"
			if emailStr != "" {
				name = strings.Split(emailStr, "@")[0]
			}

			// Use a database transaction so if one step fails, it all rolls back safely
			txErr := h.db.Transaction(func(tx *gorm.DB) error {
				// A. Create the Local User
				newUser := models.User{
					ID:    userID,
					Email: emailStr,
					Name:  name,
				}
				if err := tx.Create(&newUser).Error; err != nil {
					return err
				}

				// B. Create a Personal Organization for them
				orgID := uuid.New()
				org := models.Organization{
					ID:   orgID,
					Name: name + "'s Station",
					Plan: "free",
				}
				if err := tx.Create(&org).Error; err != nil {
					return err
				}

				// C. Make them the Owner of their new station
				orgUser := models.OrganizationUser{
					OrganizationID: org.ID,
					UserID:         newUser.ID,
					Role:           "owner",
				}
				if err := tx.Create(&orgUser).Error; err != nil {
					return err
				}

				return nil
			})

			if txErr != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to provision new user account"})
				return
			}

			// D. Re-fetch the newly created user with their fresh organization
			if err := h.db.Preload("Organizations.Organization").Where("id = ?", userIDStr).First(&user).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve provisioned account"})
				return
			}

		} else {
			// A different database error occurred
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error while fetching user"})
			return
		}
	}

	// 3. Format a clean response for the React frontend
	type OrgResponse struct {
		ID   uuid.UUID `json:"id"`
		Name string    `json:"name"`
		Role string    `json:"role"`
		Plan string    `json:"plan"`
	}

	var orgs []OrgResponse
	for _, ou := range user.Organizations {
		orgs = append(orgs, OrgResponse{
			ID:   ou.Organization.ID,
			Name: ou.Organization.Name,
			Role: ou.Role,
			Plan: ou.Organization.Plan,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"user": gin.H{
			"id":    user.ID,
			"email": user.Email,
			"name":  user.Name,
		},
		"organizations": orgs,
	})
}
