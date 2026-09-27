package handlers

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"

	"momo-radio/internal/logger"
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
		logger.Log.Info("SSE client connecting", zap.String("org_id", orgIDStr), zap.String("redis_key", key))

		c.Writer.Header().Set("Content-Type", "text/event-stream")
		c.Writer.Header().Set("Cache-Control", "no-cache")
		c.Writer.Header().Set("Connection", "keep-alive")
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Flush()

		ctx, cancel := context.WithCancel(c.Request.Context())
		defer cancel()

		// 1. Fetch current track instantly
		currentData, err := rdb.Get(ctx, key).Result()
		if err == nil && currentData != "" {
			logger.Log.Info("SSE initial cache hit", zap.String("payload", currentData))
			c.SSEvent("message", currentData)
			c.Writer.Flush()
		} else {
			logger.Log.Info("SSE initial cache miss or error", zap.Error(err))
		}

		// 2. Subscribe to track changes
		pubsub := rdb.Subscribe(ctx, key)
		defer pubsub.Close()
		ch := pubsub.Channel()

		logger.Log.Info("SSE subscribed to Redis channel", zap.String("channel", key))

		// 3. Stream Loop
		clientGone := c.Writer.CloseNotify()
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-clientGone:
				logger.Log.Info("SSE client disconnected (browser closed)", zap.String("org_id", orgIDStr))
				return
			case <-ctx.Done():
				logger.Log.Info("SSE request context cancelled", zap.String("org_id", orgIDStr))
				return
			case msg := <-ch:
				logger.Log.Info("SSE received Redis pub/sub message", zap.String("channel", msg.Channel), zap.String("payload", msg.Payload))
				c.SSEvent("message", msg.Payload)
				c.Writer.Flush()
			case <-ticker.C:
				c.Writer.Write([]byte(":\n\n"))
				c.Writer.Flush()
			}
		}
	}
}
