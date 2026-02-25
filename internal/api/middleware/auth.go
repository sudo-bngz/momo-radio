package middleware

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

var JwtSecret = []byte("super-secret-radio-key-change-me")

// RequireAuth ensures the user has a valid JWT token via Header OR Query Param.
func RequireAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		var tokenString string

		// 1. Try to get the token from the "Authorization" header
		authHeader := c.GetHeader("Authorization")
		if authHeader != "" && strings.HasPrefix(authHeader, "Bearer ") {
			tokenString = strings.TrimPrefix(authHeader, "Bearer ")
		}

		// 2. If header failed/missing, try the URL query parameter "?token=..."
		// This is critical for the <audio> tag stream!
		if tokenString == "" {
			tokenString = c.Query("token")
		}

		// 3. If BOTH are missing, then we abort
		if tokenString == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Missing or invalid token"})
			return
		}

		// 4. Parse and validate the token
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (any, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method")
			}
			return JwtSecret, nil
		})

		if err != nil || !token.Valid {
			// Helpful debug log for your server console
			fmt.Println("JWT Error:", err)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			return
		}

		// Extract claims and set them in the Gin context
		if claims, ok := token.Claims.(jwt.MapClaims); ok {
			c.Set("user_id", claims["sub"])
			c.Set("user_role", claims["role"])
			c.Next()
		} else {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid token payload"})
		}
	}
}
