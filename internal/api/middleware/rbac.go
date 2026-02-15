package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// RequireRole restricts access to specific roles.
// It MUST be used AFTER RequireAuth.
func RequireRole(allowedRoles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userRole, exists := c.Get("user_role")
		if !exists {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Role context missing"})
			return
		}

		roleStr, _ := userRole.(string)

		// Admin overrides everything
		if roleStr == "admin" {
			c.Next()
			return
		}

		// Check if the user's role matches any of the allowed roles
		for _, role := range allowedRoles {
			if roleStr == role {
				c.Next()
				return
			}
		}

		// If loop finishes without matching
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
			"error": "Forbidden: You lack the required permissions.",
		})
	}
}
