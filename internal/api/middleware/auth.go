package middleware

import (
	"net/http"
	"slices"
	"strings"

	"momo-radio/internal/models"

	"github.com/MicahParks/keyfunc/v3"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// ==========================================
// 1. JWT-ONLY MIDDLEWARE (For JIT Provisioning)
// ==========================================

// RequireValidJWT checks if the Supabase token is cryptographically valid using the cached JWKS.
func RequireValidJWT(logger *zap.Logger, jwks keyfunc.Keyfunc) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			logger.Error("AUTH ERROR: Missing Authorization header")
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Missing Authorization header"})
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")

		// Pass jwks.Keyfunc directly into the parser!
		token, err := jwt.Parse(tokenString, jwks.Keyfunc)

		if err != nil {
			logger.Error("AUTH ERROR: JWT Parse Failed", zap.Error(err))
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid token", "details": err.Error()})
			return
		}

		if !token.Valid {
			logger.Error("AUTH ERROR: Token is expired or invalid")
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Token invalid"})
			return
		}

		if claims, ok := token.Claims.(jwt.MapClaims); ok {
			c.Set("userID", claims["sub"])
			if email, exists := claims["email"]; exists {
				c.Set("email", email)
			}
			c.Next()
		} else {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid claims format"})
		}
	}
}

// ==========================================
// 2. FULL PROTECTION MIDDLEWARE (JWT + RBAC Roles)
// ==========================================

// RequireSupabaseAuth ensures the user has a valid Supabase JWT and checks their DB RBAC roles.
func RequireSupabaseAuth(logger *zap.Logger, db *gorm.DB, jwks keyfunc.Keyfunc, allowedRoles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		var tokenString string

		authHeader := c.GetHeader("Authorization")
		if authHeader != "" && strings.HasPrefix(authHeader, "Bearer ") {
			tokenString = strings.TrimPrefix(authHeader, "Bearer ")
		}
		if tokenString == "" {
			tokenString = c.Query("token")
		}

		if tokenString == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Missing token"})
			return
		}

		// Pass jwks.Keyfunc directly into the parser!
		token, err := jwt.Parse(tokenString, jwks.Keyfunc)

		if err != nil || !token.Valid {
			logger.Warn("AUTH ERROR: Invalid token during RBAC auth", zap.Error(err))
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid token claims"})
			return
		}

		userIDStr, ok := claims["sub"].(string)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Token missing subject (sub)"})
			return
		}

		userID, err := uuid.Parse(userIDStr)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid User UUID"})
			return
		}

		orgIDStr := c.GetHeader("X-Organization-Id")
		if orgIDStr == "" {
			orgIDStr = c.Query("org_id")
		}

		if orgIDStr == "" {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Missing Organization context (X-Organization-Id header or org_id param)"})
			return
		}

		orgID, err := uuid.Parse(orgIDStr)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Invalid Organization UUID format"})
			return
		}

		var orgUser models.OrganizationUser
		if err := db.Where("organization_id = ? AND user_id = ?", orgID, userID).First(&orgUser).Error; err != nil {
			logger.Warn("AUTH ERROR: Access denied to organization", zap.String("userID", userID.String()), zap.String("orgID", orgID.String()))
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "You do not have access to this organization"})
			return
		}

		if len(allowedRoles) > 0 {
			hasPermission := slices.Contains(allowedRoles, orgUser.Role)
			if !hasPermission {
				logger.Warn("AUTH ERROR: Insufficient RBAC permissions", zap.String("userID", userID.String()), zap.String("role", orgUser.Role))
				c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
				return
			}
		}

		c.Set("userID", userID)
		c.Set("organizationID", orgID)
		c.Set("userRole", orgUser.Role)
		c.Next()
	}
}
