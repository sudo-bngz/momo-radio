package audio

import (
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"

	"momo-radio/internal/config"
)

// StartFFmpeg executes the HLS transcoding process using multi-tenant dynamic parameters
func StartFFmpeg(input io.Reader, cfg *config.Config, outputDir string, bitrate string) error {
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return fmt.Errorf("failed to create tenant segment dir '%s': %w", outputDir, err)
	}

	outputFile := filepath.Join(outputDir, "stream.m3u8")

	args := []string{
		"-loglevel", cfg.Radio.LogLevel,
		"-f", cfg.Radio.InputFormat,
		"-fflags", cfg.Radio.FFlags,
		"-re",
		"-i", "pipe:0",

		"-vn",           // No Video
		"-map", "0:a:0", // Audio Only

		"-af", cfg.Radio.AudioFilter,
		"-c:a", cfg.Radio.AudioCodec,
		"-b:a", bitrate, // ⚡️ Dynamic mount point target bitrate (e.g., "128k", "320k")
		"-ac", cfg.Radio.AudioChannels,

		"-f", "hls",
		"-hls_time", strconv.Itoa(cfg.Radio.SegmentTime),
		"-hls_list_size", strconv.Itoa(cfg.Radio.ListSize),
		"-hls_flags", cfg.Radio.HLSFlags,

		outputFile,
	}

	cmd := exec.Command("ffmpeg", args...)
	cmd.Stdin = input
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	log.Printf("[FFMPEG] Pipeline starting (Bitrate: %s, Codec: %s, OutDir: %s)",
		bitrate, cfg.Radio.AudioCodec, outputDir)

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("ffmpeg execution failure: %w", err)
	}

	return nil
}

func IsSupportedFormat(filename string) bool {
	extensions := []string{
		".mp3", ".flac", ".wav", ".ogg", ".m4a", ".aac", ".wma", ".aiff", ".alac", ".opus",
	}
	for _, ext := range extensions {
		if strings.HasSuffix(filename, ext) {
			return true
		}
	}
	return false
}

func Normalize(input, output string) error {
	cmd := exec.Command("ffmpeg", "-y", "-i", input,
		"-map", "0:a:0", // Audio only
		"-map_metadata", "-1", // Strip tags
		"-write_xing", "0", // No Xing header
		"-id3v2_version", "0", // No ID3v2
		"-af", "loudnorm=I=-14:TP=-1.5:LRA=11",
		"-c:a", "libmp3lame", "-b:a", "192k",
		output)
	return cmd.Run()
}

// Validate checks if the file is large enough and decodable by ffmpeg
func Validate(path string) error {
	// 1. Check File Size (e.g., must be > 500KB to be a valid track)
	info, err := os.Stat(path)
	if err != nil {
		log.Printf("File system error: %v", err)
		return err
	}

	if info.Size() < 500*1024 {
		log.Printf("⚠️ File too small (%d bytes). Likely a failed download.", info.Size())
		return os.ErrInvalid
	}

	// 2. Check Integrity via ffprobe
	cmd := exec.Command("ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", path)
	if err := cmd.Run(); err != nil {
		log.Printf("Integrity check failed (corrupt stream): %v", err)
		return err
	}

	return nil
}
