package radio

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"os/exec"
	"regexp"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"momo-radio/internal/logger"
	"momo-radio/internal/models"
)

var rtmpCredsRegex = regexp.MustCompile(`://([^:]+):([^@]+)@`)

func (e *Engine) streamToMediaMTX(ctx context.Context, orgID uuid.UUID, mount models.MountPoint, pr *io.PipeReader) {
	defer pr.Close()

	var org struct {
		StreamKey string `gorm:"column:stream_key"`
	}
	_ = e.db.DB.Table("organizations").Select("stream_key").Where("id = ?", orgID).Scan(&org)

	rtmpURL := e.getMediaMTXRTMPURL(orgID, mount.Slug, org.StreamKey)
	bitrate := mount.Bitrate
	if bitrate <= 0 {
		bitrate = 192
	}

	logger.Log.Info("🚀 Launching RTMP pipe to MediaMTX",
		zap.String("org_id", orgID.String()),
		zap.String("rtmp_url", sanitizeRTMPURL(rtmpURL)),
		zap.Int("bitrate_kbps", bitrate),
	)

	args := []string{
		"-re",
		"-i", "pipe:0",
		"-c:a", "aac",
		"-b:a", fmt.Sprintf("%dk", bitrate),
		"-ar", "44100",
		"-ac", "2",
		"-f", "flv",
		"-flvflags", "no_duration_filesize",
		rtmpURL,
	}

	cmd := exec.CommandContext(ctx, "ffmpeg", args...)
	cmd.Stdin = pr

	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		if ctx.Err() == context.Canceled {
			logger.Log.Info("RTMP streamer stopped cleanly by context.", zap.String("org_id", orgID.String()))
			return
		}
		logger.Log.Error("RTMP streamer exited with error",
			zap.String("org_id", orgID.String()),
			zap.Error(err),
			zap.String("stderr", stderr.String()),
		)
		streamErrors.WithLabelValues(orgID.String()).Inc()
	}
}

func (e *Engine) getMediaMTXRTMPURL(orgID uuid.UUID, mountSlug string, streamKey string) string {
	host := e.cfg.MediaMTX.Host
	if host == "" {
		host = "mediamtx"
	}

	port := e.cfg.MediaMTX.RTMPPort
	if port == "" {
		port = "1935"
	}

	path := fmt.Sprintf("%s/%s", orgID.String(), mountSlug)

	if streamKey != "" {
		return fmt.Sprintf("rtmp://momo:%s@%s:%s/%s", streamKey, host, port, path)
	}
	return fmt.Sprintf("rtmp://%s:%s/%s", host, port, path)
}

func sanitizeRTMPURL(rawURL string) string {
	return rtmpCredsRegex.ReplaceAllString(rawURL, "://${1}:******@")
}
