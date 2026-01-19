package audio

import (
	"fmt"
	"io"
	"log"
	"os/exec"
	"strconv"

	"momo-radio/internal/config"
)

// StartStreamProcess starts the FFmpeg transcoding pipeline.
// We added 'runID' to ensure segment filenames are unique per session (avoids cache collisions).
func StartStreamProcess(input io.Reader, cfg *config.Config, runID int64, startSequence int64) {

	startNum := strconv.FormatInt(startSequence, 10)

	// Pattern: stream_{RunID}_{Sequence}.ts
	// Example: stream_1700000000_050.ts
	// %%03d tells FFmpeg to put the 3-digit sequence number there.
	segmentPattern := fmt.Sprintf("%s/stream_%d_%%03d.ts", cfg.Radio.SegmentDir, runID)
	playlistPath := fmt.Sprintf("%s/stream.m3u8", cfg.Radio.SegmentDir)

	args := []string{
		"-re",
		"-i", "pipe:0",

		"-c:a", "libmp3lame",
		"-b:a", "192k",
		"-ar", "44100",

		"-f", "hls",
		"-hls_time", "10",
		"-hls_list_size", "6",
		"-hls_flags", "delete_segments",
		"-hls_segment_type", "mpegts",

		// Ensure filenames are unique to this "Run"
		"-hls_segment_filename", segmentPattern,

		// Continuity logic
		"-start_number", startNum,

		playlistPath,
	}

	cmd := exec.Command("ffmpeg", args...)
	cmd.Stdin = input

	if err := cmd.Start(); err != nil {
		log.Printf("❌ FFmpeg failed to start: %v", err)
		return
	}

	log.Printf("✅ FFmpeg started (RunID: %d | Seq: %s)", runID, startNum)

	if err := cmd.Wait(); err != nil {
		log.Printf("⚠️ FFmpeg exited: %v", err)
	}
}
