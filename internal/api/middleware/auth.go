package middleware

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"slices"
	"strings"

	"momo-radio/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ==========================================
// 1. JWKS STRUCTS & PARSING HELPER
// ==========================================

// JWKS maps the Supabase JSON Web Key Set configuration
type JWKS struct {
	Keys []JWK `json:"keys"`
}

type JWK struct {
	Alg string `json:"alg"`
	Crv string `json:"crv"`
	Kid string `json:"kid"`
	Kty string `json:"kty"`
	X   string `json:"x"`
	Y   string `json:"y"`
}

// parseJWKToECPublicKey converts your Supabase JSON into a Go Elliptic Curve Key
func parseJWKToECPublicKey(jwksJSON string) (*ecdsa.PublicKey, error) {
	var jwks JWKS
	if err := json.Unmarshal([]byte(jwksJSON), &jwks); err != nil {
		return nil, fmt.Errorf("failed to parse JWKS JSON: %v", err)
	}

	if len(jwks.Keys) == 0 {
		return nil, fmt.Errorf("no keys found in JWKS")
	}

	key := jwks.Keys[0]

	// Ensure it is an Elliptic Curve P-256 key
	if key.Kty != "EC" || key.Crv != "P-256" {
		return nil, fmt.Errorf("unsupported key type or curve: kty=%s, crv=%s", key.Kty, key.Crv)
	}

	// JWKs use Raw URL Encoding (no padding)
	xBytes, err := base64.RawURLEncoding.DecodeString(key.X)
	if err != nil {
		return nil, fmt.Errorf("failed to decode X coordinate: %v", err)
	}

	yBytes, err := base64.RawURLEncoding.DecodeString(key.Y)
	if err != nil {
		return nil, fmt.Errorf("failed to decode Y coordinate: %v", err)
	}

	// Rebuild the public key for the golang-jwt parser
	pubKey := &ecdsa.PublicKey{
		Curve: elliptic.P256(),
		X:     new(big.Int).SetBytes(xBytes),
		Y:     new(big.Int).SetBytes(yBytes),
	}

	return pubKey, nil
}

// ==========================================
// 2. JWT-ONLY MIDDLEWARE (For JIT Provisioning)
// ==========================================

// RequireValidJWT checks if the Supabase token is cryptographically valid.
// It DOES NOT check the database, allowing new users to hit the JIT provisioning route.
func RequireValidJWT(secretOrPublicKey string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			fmt.Println("❌ AUTH ERROR: Missing Authorization header")
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Missing Authorization header"})
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")

		// DYNAMIC PARSER: Handles ES256 (JSON), RS256, and HS256
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			// If the token is ES256 (Your Supabase Config)
			if _, ok := token.Method.(*jwt.SigningMethodECDSA); ok {
				// Try parsing it as the JWKS JSON string
				pubKey, err := parseJWKToECPublicKey(secretOrPublicKey)
				if err == nil {
					return pubKey, nil
				}

				// Fallback: Standard PEM format
				cleanKey := strings.ReplaceAll(secretOrPublicKey, "\\n", "\n")
				return jwt.ParseECPublicKeyFromPEM([]byte(cleanKey))
			}

			// Fallback for RSA (RS256)
			if _, ok := token.Method.(*jwt.SigningMethodRSA); ok {
				cleanKey := strings.ReplaceAll(secretOrPublicKey, "\\n", "\n")
				return jwt.ParseRSAPublicKeyFromPEM([]byte(cleanKey))
			}

			// Fallback for Standard HMAC (HS256)
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); ok {
				return []byte(secretOrPublicKey), nil
			}

			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		})

		if err != nil {
			fmt.Printf("❌ AUTH ERROR: JWT Parse Failed: %v\n", err)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid token", "details": err.Error()})
			return
		}

		if !token.Valid {
			fmt.Println("❌ AUTH ERROR: Token is expired or invalid")
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
// 3. FULL PROTECTION MIDDLEWARE (JWT + RBAC Roles)
// ==========================================

// RequireSupabaseAuth ensures the user has a valid Supabase JWT and checks their DB RBAC roles.
func RequireSupabaseAuth(db *gorm.DB, jwkJSON string, allowedRoles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		var tokenString string

		// 1. Extract Token (Header fallback to Query Param)
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

		// 2. Parse the Public Key using our unified helper function
		pubKey, err := parseJWKToECPublicKey(jwkJSON)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Server misconfigured: %v", err)})
			return
		}

		// 3. Parse and Validate the Supabase JWT
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (any, error) {
			if _, ok := token.Method.(*jwt.SigningMethodECDSA); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return pubKey, nil
		})

		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			return
		}

		// 4. Extract User UUID from Token
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

		// 5. Extract Organization Context
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

		// 6. Query the Database for RBAC Role
		var orgUser models.OrganizationUser
		if err := db.Where("organization_id = ? AND user_id = ?", orgID, userID).First(&orgUser).Error; err != nil {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "You do not have access to this organization"})
			return
		}

		// 7. Validate specific RBAC Level
		if len(allowedRoles) > 0 {
			hasPermission := slices.Contains(allowedRoles, orgUser.Role)

			if !hasPermission {
				c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
				return
			}
		}

		// 8. Inject Safe Context
		c.Set("userID", userID)
		c.Set("organizationID", orgID)
		c.Set("userRole", orgUser.Role)
		c.Next()
	}
}
