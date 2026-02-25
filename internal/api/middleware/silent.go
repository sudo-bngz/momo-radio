package middleware

import (
	"fmt"
	"net"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// SilentLogger logs requests but ignores "broken pipe" errors caused by client disconnects
func SilentLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		query := c.Request.URL.RawQuery

		c.Next() // Process the request

		// 1. Check if there are any errors
		if len(c.Errors) > 0 {
			for _, e := range c.Errors {
				// Check if the error is a network "broken pipe" or "connection reset"
				if ne, ok := e.Err.(*net.OpError); ok {
					if se, ok := ne.Err.(*os.SyscallError); ok {
						errMsg := strings.ToLower(se.Error())
						if strings.Contains(errMsg, "broken pipe") ||
							strings.Contains(errMsg, "connection reset by peer") {
							return
						}
					}
				}
			}
		}

		// 2. If it wasn't a broken pipe, log the request normally
		end := time.Now()
		latency := end.Sub(start)
		clientIP := c.ClientIP()
		method := c.Request.Method
		statusCode := c.Writer.Status()

		if query != "" {
			path = path + "?" + query
		}

		// Customize this format to match your preferred log style
		fmt.Printf("[GIN] %v | %3d | %13v | %15s | %-7s %#v\n",
			end.Format("2006/01/02 - 15:04:05"),
			statusCode,
			latency,
			clientIP,
			method,
			path,
		)
	}
}
