package audio

import (
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"

	"momo-radio/internal/config"
)

// StartFFmpeg starts the HLS transcoding process using parameters from config
func StartFFmpeg(input io.Reader, cfg *config.Config) {
	if err := os.MkdirAll(cfg.Radio.SegmentDir, 0755); err != nil {
		log.Fatalf("Failed to create segment dir '%s': %v", cfg.Radio.SegmentDir, err)
	}

	outputFile := filepath.Join(cfg.Radio.SegmentDir, "stream.m3u8")

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
		"-b:a", cfg.Radio.Bitrate,
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

	log.Printf("FFmpeg Transcoder Started (Bitrate: %s, Codec: %s, SegTime: %s, Window: %s segments)",
		cfg.Radio.Bitrate, cfg.Radio.AudioCodec, strconv.Itoa(cfg.Radio.SegmentTime), strconv.Itoa(cfg.Radio.ListSize))

	if err := cmd.Run(); err != nil {
		log.Fatalf("FFmpeg crashed: %v", err)
	}
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
		log.Printf("❌ File system error: %v", err)
		return err
	}

	if info.Size() < 500*1024 {
		log.Printf("⚠️ File too small (%d bytes). Likely a failed download.", info.Size())
		return os.ErrInvalid
	}

	if strings.HasSuffix(strings.ToLower(path), ".flac") {
		log.Printf("   🧹 Cleaning FLAC headers...")
		clean := path + ".tmp"
		// Strip non-native ID3 blocks from FLAC without re-encoding
		cmd := exec.Command("ffmpeg", "-y", "-i", path, "-c", "copy", "-map_metadata", "0", clean)
		if err := cmd.Run(); err == nil {
			os.Rename(clean, path)
		}
	}

	// 2. Check Integrity via ffprobe
	// We try to read the duration; if the file is truncated, this returns an error status
	cmd := exec.Command("ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", path)
	if err := cmd.Run(); err != nil {
		log.Printf("❌ Integrity check failed (corrupt stream): %v", err)
		return err
	}

	return nil
}
