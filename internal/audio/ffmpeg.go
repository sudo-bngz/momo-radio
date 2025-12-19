package audio

import (
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
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
		"-hls_time", cfg.Radio.SegmentTime,
		"-hls_list_size", cfg.Radio.ListSize,
		"-hls_flags", cfg.Radio.HLSFlags,

		outputFile,
	}

	cmd := exec.Command("ffmpeg", args...)
	cmd.Stdin = input
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	log.Printf("🚀 FFmpeg Transcoder Started (Bitrate: %s, Codec: %s, SegTime: %ss, Window: %s segments)",
		cfg.Radio.Bitrate, cfg.Radio.AudioCodec, cfg.Radio.SegmentTime, cfg.Radio.ListSize)

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
