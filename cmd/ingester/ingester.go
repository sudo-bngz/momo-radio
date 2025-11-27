package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
	"github.com/spf13/viper"
)

// --- Configuration Struct ---
type Config struct {
	B2 struct {
		KeyID        string `mapstructure:"key_id"`
		AppKey       string `mapstructure:"app_key"`
		Endpoint     string `mapstructure:"endpoint"`
		Region       string `mapstructure:"region"`
		BucketIngest string `mapstructure:"bucket_ingest"`
		BucketProd   string `mapstructure:"bucket_prod"`
	} `mapstructure:"b2"`
	Server struct {
		TempDir         string `mapstructure:"temp_dir"`
		PollingInterval int    `mapstructure:"polling_interval_seconds"`
	} `mapstructure:"server"`
}

// Metadata holds the ID3 tags we care about for organization
type Metadata struct {
	Artist    string
	Title     string
	Genre     string
	Album     string
	Year      string
	Publisher string // Label
}

var (
	s3Client  *s3.S3
	AppConfig Config
)

func main() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	log.Println("Starting Radio Ingestion Worker (Deep Clean Mode)...")

	loadConfig()

	os.MkdirAll(AppConfig.Server.TempDir, 0755)
	initB2()

	// Start Polling Loop
	ticker := time.NewTicker(time.Duration(AppConfig.Server.PollingInterval) * time.Second)
	defer ticker.Stop()

	log.Printf("Watcher started on '%s'. Organizing into '%s' every %d seconds...",
		AppConfig.B2.BucketIngest, AppConfig.B2.BucketProd, AppConfig.Server.PollingInterval)

	// Check immediately on start
	processQueue()

	for range ticker.C {
		processQueue()
	}
}

func loadConfig() {
	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath(".")
	viper.SetEnvPrefix("RADIO")
	viper.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	viper.AutomaticEnv()

	viper.SetDefault("b2.key_id", "")
	viper.SetDefault("b2.app_key", "")
	viper.SetDefault("b2.endpoint", "")
	viper.SetDefault("b2.region", "")
	viper.SetDefault("b2.bucket_ingest", "")
	viper.SetDefault("b2.bucket_prod", "")
	viper.SetDefault("server.polling_interval_seconds", 10)
	viper.SetDefault("server.temp_dir", "./temp_processing")
	viper.SetDefault("server.polling_interval_seconds", 10)

	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); ok {
			log.Println("Warning: Config file not found, relying on ENV")
		} else {
			log.Fatalf("Error reading config file: %s", err)
		}
	}
	if err := viper.Unmarshal(&AppConfig); err != nil {
		log.Fatalf("Unable to decode into struct: %v", err)
	}
	if AppConfig.Server.PollingInterval <= 0 {
		log.Println("Config Warning: 'polling_interval_seconds' is 0 or missing. Defaulting to 10 seconds.")
		AppConfig.Server.PollingInterval = 10
	}
	if AppConfig.B2.KeyID == "" {
		log.Fatal("Critical config missing: B2 KeyID")
	}
}

func initB2() {
	s3Config := &aws.Config{
		Credentials:      credentials.NewStaticCredentials(AppConfig.B2.KeyID, AppConfig.B2.AppKey, ""),
		Endpoint:         aws.String(AppConfig.B2.Endpoint),
		Region:           aws.String(AppConfig.B2.Region),
		S3ForcePathStyle: aws.Bool(true),
	}
	sess := session.Must(session.NewSession(s3Config))
	s3Client = s3.New(sess)
	log.Println("✅ Connected to Backblaze B2")
}

func processQueue() {
	// List objects in Ingest Bucket
	resp, err := s3Client.ListObjectsV2(&s3.ListObjectsV2Input{
		Bucket: aws.String(AppConfig.B2.BucketIngest),
	})
	if err != nil {
		log.Printf("Error listing bucket: %v", err)
		return
	}

	if len(resp.Contents) == 0 {
		return
	}

	log.Printf("Found %d items in ingest queue.", len(resp.Contents))

	for _, item := range resp.Contents {
		key := *item.Key
		if strings.HasSuffix(key, "/") || !strings.HasSuffix(strings.ToLower(key), ".mp3") {
			continue
		}

		log.Printf("Processing: %s", key)
		if err := processSingleFile(key); err != nil {
			log.Printf("❌ FAILED %s: %v", key, err)
		} else {
			log.Printf("✅ ORGANIZED %s", key)
		}
	}
}

func processSingleFile(key string) error {
	localRawPath := filepath.Join(AppConfig.Server.TempDir, "raw_"+filepath.Base(key))
	localCleanPath := filepath.Join(AppConfig.Server.TempDir, "clean_"+filepath.Base(key))

	defer os.Remove(localRawPath)
	defer os.Remove(localCleanPath)

	// 1. Download
	if err := downloadFile(AppConfig.B2.BucketIngest, key, localRawPath); err != nil {
		return fmt.Errorf("download failed: %w", err)
	}

	// 2. Extract Metadata (ID3 Tags)
	meta, err := getMetadata(localRawPath)
	if err != nil {
		log.Printf("Warning: Could not read metadata for %s: %v", key, err)
	}

	// 3. Build Organization Path
	destinationKey := buildOrganizationalPath(meta, key)

	// 4. Normalize & STRIP ALL HEADERS
	log.Printf("   -> Normalizing audio and stripping headers...")
	if err := normalizeAudio(localRawPath, localCleanPath); err != nil {
		return fmt.Errorf("normalization failed: %w", err)
	}

	// 5. Upload
	log.Printf("   -> Uploading to: %s", destinationKey)
	if err := uploadFile(AppConfig.B2.BucketProd, destinationKey, localCleanPath); err != nil {
		return fmt.Errorf("upload failed: %w", err)
	}

	// 6. Delete Original
	_, delErr := s3Client.DeleteObject(&s3.DeleteObjectInput{
		Bucket: aws.String(AppConfig.B2.BucketIngest),
		Key:    aws.String(key),
	})

	return delErr
}

// --- Logic Helpers ---

func buildOrganizationalPath(meta Metadata, originalKey string) string {
	// Defaults
	genre := "Unknown_Genre"
	year := "0000"
	label := "Independent"
	album := "Unknown_Album"
	artist := "Unknown_Artist"
	title := "Unknown_Title"

	if meta.Genre != "" {
		genre = sanitize(meta.Genre)
	}
	if meta.Year != "" {
		year = sanitizeYear(meta.Year)
	}
	if meta.Publisher != "" {
		label = sanitize(meta.Publisher)
	}
	if meta.Album != "" {
		album = sanitize(meta.Album)
	}
	if meta.Artist != "" {
		artist = sanitize(meta.Artist)
	}
	if meta.Title != "" {
		title = sanitize(meta.Title)
	}

	// Fallback: Use filename if Artist/Title missing
	if meta.Artist == "" || meta.Title == "" {
		base := filepath.Base(originalKey)
		ext := filepath.Ext(base)
		title = sanitize(strings.TrimSuffix(base, ext))
		artist = "Unknown"
	}

	// Format: music/Genre/Year/Label/Artist/Album/Artist-Title.mp3
	filename := fmt.Sprintf("%s-%s.mp3", artist, title)
	return fmt.Sprintf("music/%s/%s/%s/%s/%s/%s", genre, year, label, artist, album, filename)
}

func sanitizeYear(dateStr string) string {
	if len(dateStr) >= 4 {
		year := dateStr[:4]
		if match, _ := regexp.MatchString(`^\d{4}$`, year); match {
			return year
		}
	}
	return "0000"
}

func sanitize(text string) string {
	reg, _ := regexp.Compile(`[^a-zA-Z0-9\-\s]+`)
	clean := reg.ReplaceAllString(text, "")
	return strings.ReplaceAll(strings.TrimSpace(clean), " ", "_")
}

// --- FFmpeg / S3 Wrappers ---

func getMetadata(path string) (Metadata, error) {
	cmd := exec.Command("ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", path)
	var out bytes.Buffer
	cmd.Stdout = &out
	if err := cmd.Run(); err != nil {
		return Metadata{}, err
	}

	type FFProbeOutput struct {
		Format struct {
			Tags map[string]string `json:"tags"`
		} `json:"format"`
	}
	var data FFProbeOutput
	if err := json.Unmarshal(out.Bytes(), &data); err != nil {
		return Metadata{}, err
	}

	tags := data.Format.Tags
	meta := Metadata{
		Artist:    tags["artist"],
		Title:     tags["title"],
		Album:     tags["album"],
		Genre:     tags["genre"],
		Year:      tags["date"],
		Publisher: tags["publisher"],
	}

	if meta.Publisher == "" {
		if val, ok := tags["organization"]; ok {
			meta.Publisher = val
		}
		if val, ok := tags["copyright"]; ok {
			meta.Publisher = val
		}
	}
	if meta.Year == "" {
		if val, ok := tags["year"]; ok {
			meta.Year = val
		}
		if val, ok := tags["TYER"]; ok {
			meta.Year = val
		}
	}

	return meta, nil
}

func normalizeAudio(input, output string) error {
	// UPDATED: Added flags to strip EVERYTHING non-audio
	cmd := exec.Command("ffmpeg", "-y", "-i", input,
		"-map", "0:a:0", // Select only the first audio stream (ignores video/art)
		"-map_metadata", "-1", // REMOVE Global Metadata (Tags)
		"-write_xing", "0", // REMOVE Xing Header (VBR header that causes glitches in streams)
		"-id3v2_version", "0", // DISABLE ID3v2 tags completely
		"-af", "loudnorm=I=-14:TP=-1.5:LRA=11",
		"-c:a", "libmp3lame", "-b:a", "192k",
		output)
	return cmd.Run()
}

func downloadFile(bucket, key, filepath string) error {
	file, err := os.Create(filepath)
	if err != nil {
		return err
	}
	defer file.Close()
	obj, err := s3Client.GetObject(&s3.GetObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return err
	}
	defer obj.Body.Close()
	_, err = io.Copy(file, obj.Body)
	return err
}

func uploadFile(bucket, key, filepath string) error {
	file, err := os.Open(filepath)
	if err != nil {
		return err
	}
	defer file.Close()
	_, err = s3Client.PutObject(&s3.PutObjectInput{
		Bucket:      aws.String(bucket),
		Key:         aws.String(key),
		Body:        file,
		ContentType: aws.String("audio/mpeg"),
	})
	return err
}
