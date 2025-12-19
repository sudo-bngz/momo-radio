package audio

import (
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"

	"momo-radio/internal/config"
)

func StartStreamProcess(input io.Reader, cfg *config.Config, runID int64) {
	dir := cfg.Radio.SegmentDir
	if err := os.MkdirAll(dir, 0755); err != nil {
		log.Fatalf("Failed to create segment dir: %v", err)
	}

	// Unique pattern based on runID to avoid collisions on restarts
	segmentPattern := filepath.Join(dir, fmt.Sprintf("stream_%d_%%03d.ts", runID))
	playlistPath := filepath.Join(dir, "stream.m3u8")

	args := []string{
		"-loglevel", cfg.Radio.LogLevel,
		"-f", cfg.Radio.InputFormat,
		"-fflags", cfg.Radio.FFlags,
		"-re",
		"-i", "pipe:0",

		"-vn", "-map", "0:a:0",

		"-af", cfg.Radio.AudioFilter,
		"-c:a", cfg.Radio.AudioCodec,
		"-b:a", cfg.Radio.Bitrate,
		"-ac", cfg.Radio.AudioChannels,

		"-f", "hls",
		"-hls_time", cfg.Radio.SegmentTime,
		"-hls_list_size", cfg.Radio.ListSize,
		"-hls_flags", cfg.Radio.HLSFlags,
		"-hls_segment_filename", segmentPattern,
		playlistPath,
	}

	cmd := exec.Command("ffmpeg", args...)
	cmd.Stdin = input
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	log.Println("🚀 FFmpeg Transcoder Started")
	if err := cmd.Run(); err != nil {
		log.Fatalf("FFmpeg crashed: %v", err)
	}
}
