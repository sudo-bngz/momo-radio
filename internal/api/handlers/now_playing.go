package handlers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

// StreamNowPlaying handles Server-Sent Events (SSE) to push live track updates to listeners.
func StreamNowPlaying(rdb *redis.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		orgIDStr := c.Param("org_id")
		if _, err := uuid.Parse(orgIDStr); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid organization ID"})
			return
		}

		key := fmt.Sprintf("radio:%s:now_playing", orgIDStr)

		// 1. Set required headers for Server-Sent Events
		c.Writer.Header().Set("Content-Type", "text/event-stream")
		c.Writer.Header().Set("Cache-Control", "no-cache")
		c.Writer.Header().Set("Connection", "keep-alive")
		// Browsers need CORS headers here if the player lives on a different domain
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")

		// 2. Fetch the current track instantly so the UI doesn't have to wait for the next song
		currentData, err := rdb.Get(c.Request.Context(), key).Result()
		if err == nil && currentData != "" {
			c.SSEvent("message", currentData)
			c.Writer.Flush()
		}

		// 3. Subscribe to the Pub/Sub channel for live pushes
		pubsub := rdb.Subscribe(c.Request.Context(), key)
		defer pubsub.Close()
		ch := pubsub.Channel()

		// 4. Stream Loop: Listen for Redis events or Client disconnects
		clientGone := c.Writer.CloseNotify()
		ticker := time.NewTicker(30 * time.Second) // Keep-alive ping for proxies/load-balancers
		defer ticker.Stop()

		for {
			select {
			case <-clientGone:
				// The user closed the browser tab; terminate the goroutine cleanly.
				return
			case msg := <-ch:
				// A new track started! Push it to the browser.
				c.SSEvent("message", msg.Payload)
				c.Writer.Flush()
			case <-ticker.C:
				// Send a comment to prevent the connection from timing out
				c.Writer.Write([]byte(":\n\n"))
				c.Writer.Flush()
			}
		}
	}
}
