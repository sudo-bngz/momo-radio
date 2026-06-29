package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"momo-radio/internal/models"
)

type MembersHandler struct {
	db *gorm.DB
}

func NewMembersHandler(db *gorm.DB) *MembersHandler {
	return &MembersHandler{db: db}
}

// Generate a secure random token for the invite link
func generateInviteToken() string {
	bytes := make([]byte, 32)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

// GetMembers lists current active users in the organization
func (h *MembersHandler) GetMembers(c *gin.Context) {
	orgID, _ := getOrgID(c) // Reusing your helper

	var orgUsers []models.OrganizationUser
	if err := h.db.Preload("User").Preload("User.Profile").Where("organization_id = ?", orgID).Find(&orgUsers).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve members"})
		return
	}

	c.JSON(http.StatusOK, orgUsers)
}

// InviteMember creates a pending invitation and triggers an email
func (h *MembersHandler) InviteMember(c *gin.Context) {
	orgID, _ := getOrgID(c)

	var req struct {
		Email string `json:"email" binding:"required,email"`
		Role  string `json:"role" binding:"required,oneof=admin editor viewer dj"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request parameters"})
		return
	}

	// 1. Check if user is already in the organization
	var existingUser models.User
	if err := h.db.Where("email = ?", req.Email).First(&existingUser).Error; err == nil {
		var isMember int64
		h.db.Model(&models.OrganizationUser{}).Where("organization_id = ? AND user_id = ?", orgID, existingUser.ID).Count(&isMember)
		if isMember > 0 {
			c.JSON(http.StatusConflict, gin.H{"error": "User is already a member of this workspace"})
			return
		}
	}

	// 2. Create the Invitation
	invite := models.OrganizationInvite{
		OrganizationID: orgID,
		Email:          req.Email,
		Role:           req.Role,
		Token:          generateInviteToken(),
		ExpiresAt:      time.Now().Add(7 * 24 * time.Hour), // 7 days expiration
	}

	if err := h.db.Create(&invite).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create invitation"})
		return
	}

	// 3. TODO: Send the actual email here!
	// For now, we will print the link to your Go console so you can test it locally.
	inviteLink := "http://localhost:5173/signup?invite=" + invite.Token
	println("MOCK EMAIL SENT TO:", req.Email)
	println("INVITE LINK:", inviteLink)

	c.JSON(http.StatusOK, gin.H{"message": "Invitation sent successfully", "invite_id": invite.ID})
}

// AcceptInvite consumes the token and adds the user to the workspace
func (h *MembersHandler) AcceptInvite(c *gin.Context) {
	// The user must be authenticated (logged in/signed up) to accept an invite
	userIDStr := c.GetString("userID")
	userID, _ := uuid.Parse(userIDStr)

	var req struct {
		Token string `json:"token" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing token"})
		return
	}

	// 1. Find valid pending invite
	var invite models.OrganizationInvite
	if err := h.db.Where("token = ? AND accepted_at IS NULL AND expires_at > ?", req.Token, time.Now()).First(&invite).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invalid or expired invitation link"})
		return
	}

	// 2. Consume token and attach user inside a transaction
	err := h.db.Transaction(func(tx *gorm.DB) error {
		// Mark accepted
		now := time.Now()
		if err := tx.Model(&invite).Update("accepted_at", &now).Error; err != nil {
			return err
		}

		// Create the membership link
		orgUser := models.OrganizationUser{
			OrganizationID: invite.OrganizationID,
			UserID:         userID,
			Role:           invite.Role,
		}

		// Use FirstOrCreate to handle edge cases gracefully
		return tx.FirstOrCreate(&orgUser, models.OrganizationUser{
			OrganizationID: invite.OrganizationID,
			UserID:         userID,
		}).Error
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to accept invitation"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Welcome to the workspace!"})
}
