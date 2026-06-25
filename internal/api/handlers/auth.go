package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"strings"
	"time"

	"momo-radio/internal/models"
	"momo-radio/internal/utils"

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

// Helper to generate a secure random stream key
func generateStreamKey() string {
	bytes := make([]byte, 10)
	rand.Read(bytes)
	return "live_" + hex.EncodeToString(bytes)
}

// ----------------------------------------------------------------------------
// 1. SUPABASE WEBHOOK HANDLER
// ----------------------------------------------------------------------------

type SupabaseWebhookPayload struct {
	Type   string `json:"type"`
	Record struct {
		ID    string `json:"id"`
		Email string `json:"email"`

		RawUserMetaData struct {
			Name      string `json:"name"`
			FullName  string `json:"full_name"`
			FirstName string `json:"first_name"`
			LastName  string `json:"last_name"`
			AvatarURL string `json:"avatar_url"`
		} `json:"raw_user_meta_data"`
	} `json:"record"`
}

func (h *AuthHandler) HandleSupabaseWebhook(c *gin.Context) {
	var payload SupabaseWebhookPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid webhook payload"})
		return
	}

	if payload.Type != "INSERT" {
		c.JSON(http.StatusOK, gin.H{"message": "Ignored non-insert event"})
		return
	}

	userID, err := uuid.Parse(payload.Record.ID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user UUID"})
		return
	}

	// Smart Name Parsing for the Profile
	meta := payload.Record.RawUserMetaData
	name := meta.Name
	if name == "" {
		name = meta.FullName
	}

	firstName := meta.FirstName
	lastName := meta.LastName

	// Fallback if identity provider only gives "full_name"
	if firstName == "" && name != "" {
		parts := strings.SplitN(name, " ", 2)
		firstName = parts[0]
		if len(parts) > 1 {
			lastName = parts[1]
		}
	}

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

		// ⚡️ 2. Create the User Profile automatically
		profile := models.UserProfile{
			ID:        userID,
			FirstName: firstName,
			LastName:  lastName,
			AvatarURL: meta.AvatarURL,
			UpdatedAt: time.Now(),
		}
		if err := tx.Create(&profile).Error; err != nil {
			return err
		}

		// 3. Create a default Personal Organization
		orgName := firstName + "'s Station"
		if firstName == "" {
			orgName = "My Station"
		}

		org := models.Organization{
			Name:        orgName,
			StationSlug: utils.SanitizeSlug(orgName),
			StreamKey:   generateStreamKey(),
			Plan:        "free",
			MountPoints: []models.MountPoint{
				{
					Name:      "Standard Quality",
					Slug:      "radio",
					Bitrate:   128,
					IsDefault: true,
				},
			},
		}
		if err := tx.Create(&org).Error; err != nil {
			return err
		}

		// 4. Make them the Owner
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

	c.JSON(http.StatusCreated, gin.H{"message": "User, Profile, and Organization provisioned successfully"})
}

// ----------------------------------------------------------------------------
// 2. FETCH CURRENT USER CONTEXT & JIT PROVISIONING
// ----------------------------------------------------------------------------

func (h *AuthHandler) GetMe(c *gin.Context) {
	userIDStr := c.GetString("userID")
	emailStr := c.GetString("email")

	if userIDStr == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User context not found"})
		return
	}

	var user models.User

	err := h.db.Preload("Organizations.Organization").Where("id = ?", userIDStr).First(&user).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {

			userID, parseErr := uuid.Parse(userIDStr)
			if parseErr != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user UUID format"})
				return
			}

			name := "New User"
			if emailStr != "" {
				name = strings.Split(emailStr, "@")[0]
			}

			txErr := h.db.Transaction(func(tx *gorm.DB) error {
				// A. Create Local User
				newUser := models.User{
					ID:    userID,
					Email: emailStr,
					Name:  name,
				}
				if err := tx.Create(&newUser).Error; err != nil {
					return err
				}

				// ⚡️ B. Create Local Profile Fallback
				profile := models.UserProfile{
					ID:        userID,
					FirstName: name, // Default to email prefix
					LastName:  "",
					UpdatedAt: time.Now(),
				}
				if err := tx.Create(&profile).Error; err != nil {
					return err
				}

				// C. Create Organization
				orgID := uuid.New()
				orgName := name + "'s Station"
				org := models.Organization{
					ID:          orgID,
					Name:        orgName,
					StationSlug: utils.SanitizeSlug(orgName),
					StreamKey:   generateStreamKey(),
					Plan:        "free",
					MountPoints: []models.MountPoint{
						{
							Name:      "Standard Quality",
							Slug:      "radio",
							Bitrate:   128,
							IsDefault: true,
						},
					},
				}
				if err := tx.Create(&org).Error; err != nil {
					return err
				}

				// D. Assign Owner Role
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

			if err := h.db.Preload("Organizations.Organization").Where("id = ?", userIDStr).First(&user).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve provisioned account"})
				return
			}

		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error while fetching user"})
			return
		}
	}

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
