package audio

import (
	"fmt"
	"io"
	"log"
	"os/exec"
	"path/filepath"
	"strconv"

	"momo-radio/internal/config"
)

func StartStreamProcess(input io.Reader, cfg *config.Config, runID int64, startSequence int64, segmentDir string, targetBitrate int) {

	startNum := strconv.FormatInt(startSequence, 10)

	// Route output to the tenant-specific directory
	segmentPattern := filepath.Join(segmentDir, fmt.Sprintf("stream_%d_%%03d.ts", runID))
	playlistPath := filepath.Join(segmentDir, "stream.m3u8")

	// Format the dynamic bitrate from the database (e.g., 128 -> "128k")
	// If for some reason it is 0, we gracefully fallback to the viper config
	var bitrate string
	if targetBitrate > 0 {
		bitrate = fmt.Sprintf("%dk", targetBitrate)
	} else {
		bitrate = fallbackStr(cfg.Radio.Bitrate, "192k")
	}

	// Pull remaining FFmpeg parameters dynamically from your Viper Config
	codec := fallbackStr(cfg.Radio.AudioCodec, "libmp3lame")
	sampleRate := fallbackStr(cfg.Radio.SampleRate, "44100")

	hlsTime := fallbackInt(cfg.Radio.SegmentTime, 10)
	hlsListSize := fallbackInt(cfg.Radio.ListSize, 6)

	args := []string{
		"-re",
		"-i", "pipe:0",

		// Audio Configuration (Now using dynamic DB bitrate)
		"-c:a", codec,
		"-b:a", bitrate,
		"-ar", sampleRate,

		// HLS Configuration via Viper
		"-f", "hls",
		"-hls_time", strconv.Itoa(hlsTime),
		"-hls_list_size", strconv.Itoa(hlsListSize),
		"-hls_flags", "delete_segments",
		"-hls_segment_type", "mpegts",

		// Output Routing
		"-hls_segment_filename", segmentPattern,
		"-start_number", startNum,
		playlistPath,
	}

	cmd := exec.Command("ffmpeg", args...)
	cmd.Stdin = input

	if err := cmd.Start(); err != nil {
		log.Printf("FFmpeg failed to start: %v", err)
		return
	}

	log.Printf("FFmpeg started (RunID: %d | Seq: %s | Dir: %s | Bitrate: %s)", runID, startNum, segmentDir, bitrate)

	if err := cmd.Wait(); err != nil {
		log.Printf("FFmpeg exited: %v", err)
	}
}

// --- Helper functions for safe config reading ---

func fallbackStr(val, fallback string) string {
	if val == "" {
		return fallback
	}
	return val
}

func fallbackInt(val, fallback int) int {
	if val == 0 {
		return fallback
	}
	return val
}
