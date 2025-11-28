package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
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
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
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
		MetricsPort     string `mapstructure:"metrics_port"`
	} `mapstructure:"server"`
	// Removed Services struct as we default to iTunes public API now
}

// Metadata holds the tags for organization
type Metadata struct {
	Artist    string `json:"artist"`
	Title     string `json:"title"`
	Genre     string `json:"genre"`
	Album     string `json:"album"`
	Year      string `json:"year"`
	Publisher string `json:"publisher"`
}

// iTunes API Response Structures
type ITunesResponse struct {
	ResultCount int            `json:"resultCount"`
	Results     []ITunesResult `json:"results"`
}

type ITunesResult struct {
	ArtistName       string `json:"artistName"`
	TrackName        string `json:"trackName"`
	CollectionName   string `json:"collectionName"` // Album
	PrimaryGenreName string `json:"primaryGenreName"`
	ReleaseDate      string `json:"releaseDate"` // e.g. "1997-01-20T08:00:00Z"
	// We could also get artworkUrl100 if we wanted cover art
}

var (
	s3Client  *s3.S3
	AppConfig Config

	// --- Prometheus Metrics ---
	ingestJobs = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "radio_ingest_jobs_total",
			Help: "Total number of files processed by the ingester",
		},
		[]string{"status"},
	)
	ingestDuration = prometheus.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "radio_ingest_duration_seconds",
			Help:    "Time taken to process a single track",
			Buckets: prometheus.DefBuckets,
		},
	)
)

func main() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	log.Println("Starting Radio Ingestion Worker (iTunes Enrichment Mode)...")

	prometheus.MustRegister(ingestJobs, ingestDuration)

	loadConfig()

	os.MkdirAll(AppConfig.Server.TempDir, 0755)
	initB2()

	go func() {
		port := AppConfig.Server.MetricsPort
		if port == "" {
			port = ":9091"
		}
		http.Handle("/metrics", promhttp.Handler())
		log.Printf("📊 Metrics exposed at http://localhost%s/metrics", port)
		log.Fatal(http.ListenAndServe(port, nil))
	}()

	ticker := time.NewTicker(time.Duration(AppConfig.Server.PollingInterval) * time.Second)
	defer ticker.Stop()

	log.Printf("Watcher started on '%s'.", AppConfig.B2.BucketIngest)

	processQueue()

	for range ticker.C {
		processQueue()
	}
}

func loadConfig() {
	viper.SetEnvPrefix("RADIO")
	viper.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	viper.AutomaticEnv()

	viper.BindEnv("b2.key_id")
	viper.BindEnv("b2.app_key")
	viper.BindEnv("b2.endpoint")
	viper.BindEnv("b2.region")
	viper.BindEnv("b2.bucket_ingest")
	viper.BindEnv("b2.bucket_prod")
	viper.BindEnv("server.temp_dir")
	viper.BindEnv("server.polling_interval_seconds")
	viper.BindEnv("server.metrics_port")

	viper.SetDefault("server.polling_interval_seconds", 10)
	viper.SetDefault("server.temp_dir", "./temp_processing")
	viper.SetDefault("server.metrics_port", ":9091")

	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath(".")

	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); ok {
			log.Println("Info: config.yaml not found, using Environment Variables only.")
		} else {
			log.Printf("Warning: Error reading config file: %s", err)
		}
	}

	if err := viper.Unmarshal(&AppConfig); err != nil {
		log.Fatalf("Unable to decode into struct: %v", err)
	}

	if AppConfig.B2.KeyID == "" {
		log.Fatal("Critical config missing: B2 KeyID (RADIO_B2_KEY_ID)")
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
		lowerKey := strings.ToLower(key)

		if strings.HasSuffix(key, "/") || !isSupportedFormat(lowerKey) {
			continue
		}

		log.Printf("Processing: %s", key)
		if err := processSingleFile(key); err != nil {
			log.Printf("❌ FAILED %s: %v", key, err)
			ingestJobs.WithLabelValues("failure").Inc()
		} else {
			log.Printf("✅ ORGANIZED %s", key)
			ingestJobs.WithLabelValues("success").Inc()
		}
	}
}

func isSupportedFormat(filename string) bool {
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

func processSingleFile(key string) error {
	timer := prometheus.NewTimer(ingestDuration)
	defer timer.ObserveDuration()

	baseName := filepath.Base(key)
	ext := filepath.Ext(baseName)
	nameWithoutExt := strings.TrimSuffix(baseName, ext)

	localRawPath := filepath.Join(AppConfig.Server.TempDir, "raw_"+baseName)
	localCleanPath := filepath.Join(AppConfig.Server.TempDir, "clean_"+nameWithoutExt+".mp3")

	defer os.Remove(localRawPath)
	defer os.Remove(localCleanPath)

	// 1. Download
	if err := downloadFile(AppConfig.B2.BucketIngest, key, localRawPath); err != nil {
		return fmt.Errorf("download failed: %w", err)
	}

	// 2. Extract Local Metadata
	meta, err := getMetadata(localRawPath)
	if err != nil {
		log.Printf("Warning: Could not read local metadata for %s: %v", key, err)
	}

	// 3. ENRICHMENT: Call iTunes if tags are missing
	if meta.Artist == "" || meta.Title == "" {
		log.Printf("   🔍 Missing tags. Querying iTunes for: %s", baseName)
		enriched, err := fetchITunesMetadata(baseName)
		if err != nil {
			log.Printf("   ⚠️ iTunes lookup failed: %v", err)
		} else {
			// Merge data (iTunes data takes priority if local is empty)
			if enriched.Artist != "" {
				meta.Artist = enriched.Artist
			}
			if enriched.Title != "" {
				meta.Title = enriched.Title
			}
			if enriched.Album != "" {
				meta.Album = enriched.Album
			}
			if enriched.Genre != "" {
				meta.Genre = enriched.Genre
			}
			if enriched.Year != "" {
				meta.Year = enriched.Year
			}

			// iTunes doesn't give "Label/Publisher" in the free API usually,
			// so we keep local or default.
			log.Printf("   ✨ Enriched: %s - %s (%s)", meta.Artist, meta.Title, meta.Year)
		}
	}

	// 4. Build Path
	destinationKey := buildOrganizationalPath(meta, key)

	// 5. Normalize
	log.Printf("   -> Normalizing audio and stripping headers...")
	if err := normalizeAudio(localRawPath, localCleanPath); err != nil {
		return fmt.Errorf("normalization failed: %w", err)
	}

	// 6. Upload
	log.Printf("   -> Uploading to: %s", destinationKey)
	if err := uploadFile(AppConfig.B2.BucketProd, destinationKey, localCleanPath); err != nil {
		return fmt.Errorf("upload failed: %w", err)
	}

	// 7. Delete Original
	_, delErr := s3Client.DeleteObject(&s3.DeleteObjectInput{
		Bucket: aws.String(AppConfig.B2.BucketIngest),
		Key:    aws.String(key),
	})

	return delErr
}

// --- iTunes Metadata Logic ---

func fetchITunesMetadata(filename string) (Metadata, error) {
	// Clean the filename to get a search term
	// e.g. "Daft_Punk-One_More_Time.flac" -> "Daft Punk One More Time"
	searchTerm := cleanFilenameForSearch(filename)

	// iTunes API URL
	apiURL := "https://itunes.apple.com/search"
	u, _ := url.Parse(apiURL)
	q := u.Query()
	q.Set("term", searchTerm)
	q.Set("media", "music")
	q.Set("entity", "song")
	q.Set("limit", "1") // We only want the best match
	u.RawQuery = q.Encode()

	// Make Request
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(u.String())
	if err != nil {
		return Metadata{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return Metadata{}, fmt.Errorf("iTunes returned status %d", resp.StatusCode)
	}

	// Parse Response
	var result ITunesResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return Metadata{}, err
	}

	if result.ResultCount == 0 || len(result.Results) == 0 {
		return Metadata{}, fmt.Errorf("no results found for '%s'", searchTerm)
	}

	track := result.Results[0]

	// Convert Date "2001-03-12T08..." to "2001"
	year := ""
	if len(track.ReleaseDate) >= 4 {
		year = track.ReleaseDate[:4]
	}

	return Metadata{
		Artist: track.ArtistName,
		Title:  track.TrackName,
		Album:  track.CollectionName,
		Genre:  track.PrimaryGenreName,
		Year:   year,
	}, nil
}

func cleanFilenameForSearch(filename string) string {
	// Remove extension
	ext := filepath.Ext(filename)
	clean := strings.TrimSuffix(filename, ext)

	// Replace separators with spaces
	clean = strings.ReplaceAll(clean, "_", " ")
	clean = strings.ReplaceAll(clean, "-", " ")

	// Remove common junk like "(Original Mix)", "hq", etc if you want to be fancy,
	// but simple space replacement usually works for iTunes fuzzy search.
	return clean
}

// --- Logic Helpers ---

func buildOrganizationalPath(meta Metadata, originalKey string) string {
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

	if meta.Artist == "" || meta.Title == "" {
		base := filepath.Base(originalKey)
		ext := filepath.Ext(base)
		title = sanitize(strings.TrimSuffix(base, ext))
		artist = "Unknown"
	}

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

	getTag := func(keys ...string) string {
		for _, k := range keys {
			if val, ok := tags[k]; ok && val != "" {
				return val
			}
			if val, ok := tags[strings.ToUpper(k)]; ok && val != "" {
				return val
			}
		}
		return ""
	}

	meta := Metadata{
		Artist:    getTag("artist", "album_artist"),
		Title:     getTag("title"),
		Album:     getTag("album"),
		Genre:     getTag("genre"),
		Year:      getTag("date", "year", "TYER", "creation_time"),
		Publisher: getTag("publisher", "organization", "copyright", "label"),
	}

	return meta, nil
}

func normalizeAudio(input, output string) error {
	cmd := exec.Command("ffmpeg", "-y", "-i", input,
		"-map", "0:a:0",
		"-map_metadata", "-1",
		"-write_xing", "0",
		"-id3v2_version", "0",
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
