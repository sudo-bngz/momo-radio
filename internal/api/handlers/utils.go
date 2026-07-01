package handlers

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func getOrgID(c *gin.Context) (uuid.UUID, bool) {
	orgIDRaw, exists := c.Get("organizationID")
	if !exists {
		return uuid.Nil, false
	}
	orgID, ok := orgIDRaw.(uuid.UUID)
	return orgID, ok
}
