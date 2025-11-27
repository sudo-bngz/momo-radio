package main

import (
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
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
		BucketProd   string `mapstructure:"bucket_prod"`
		BucketStream string `mapstructure:"bucket_stream_live"`
	} `mapstructure:"b2"`
}

const (
	SegmentDir    = "./hls_output"
	PrefixMusic   = "music/"
	PrefixJingles = "station_id/"
	WebServerPort = ":8080"
)

var (
	s3Client  *s3.S3
	AppConfig Config
)

func main() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	log.Println("Starting GoWebRadio Engine (Race-Free Mode)...")

	loadConfig()

	os.RemoveAll(SegmentDir)
	os.MkdirAll(SegmentDir, 0755)

	initB2()

	audioPipeReader, audioPipeWriter := io.Pipe()

	go startFFmpeg(audioPipeReader)
	go startSmartDJ(audioPipeWriter)
	go startRedirectServer()

	log.Println("Starting Stream Uploader...")
	startStreamUploader()
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
	viper.SetDefault("b2.bucket_prod", "")
	viper.SetDefault("b2.bucket_stream_live", "")

	if err := viper.ReadInConfig(); err != nil {
		log.Fatalf("Error reading config: %s", err)
	}
	if err := viper.Unmarshal(&AppConfig); err != nil {
		log.Fatalf("Unable to decode struct: %v", err)
	}
	if AppConfig.B2.KeyID == "" {
		log.Fatal("Critical config missing: B2 KeyID")
	}
	if AppConfig.B2.BucketStream == "" {
		log.Fatal("Critical config missing: bucket_stream_live is empty.")
	}
}

func initB2() {
	log.Printf("--- B2 Init ---")
	log.Printf("Source: %s", AppConfig.B2.BucketProd)
	log.Printf("Stream: %s", AppConfig.B2.BucketStream)

	s3Config := &aws.Config{
		Credentials:      credentials.NewStaticCredentials(AppConfig.B2.KeyID, AppConfig.B2.AppKey, ""),
		Endpoint:         aws.String(AppConfig.B2.Endpoint),
		Region:           aws.String(AppConfig.B2.Region),
		S3ForcePathStyle: aws.Bool(true),
	}
	sess, err := session.NewSession(s3Config)
	if err != nil {
		log.Fatalf("Session error: %v", err)
	}
	s3Client = s3.New(sess)
}

// --- VLC Redirect Helper ---
func startRedirectServer() {
	endpoint := strings.TrimRight(AppConfig.B2.Endpoint, "/")

	// Correct S3 format: https://s3.region.backblazeb2.com/bucket-name/key
	publicURL := fmt.Sprintf("%s/%s/stream.m3u8", endpoint, AppConfig.B2.BucketStream)

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		html := fmt.Sprintf(`<h1>📻 Radio Live</h1><p>VLC URL: <a href="/listen">http://localhost%s/listen</a></p><p>Cloud URL: %s</p>`, WebServerPort, publicURL)
		fmt.Fprint(w, html)
	})

	http.HandleFunc("/listen", func(w http.ResponseWriter, r *http.Request) {
		log.Printf("Redirecting client to: %s", publicURL)
		http.Redirect(w, r, publicURL, http.StatusFound)
	})

	log.Printf("🌍 Web Helper running at http://localhost%s", WebServerPort)
	log.Fatal(http.ListenAndServe(WebServerPort, nil))
}

// --- DEBUG HELPER ---
type ProgressReader struct {
	Reader io.Reader
	Total  int64
}

func (pr *ProgressReader) Read(p []byte) (int, error) {
	n, err := pr.Reader.Read(p)
	pr.Total += int64(n)
	if pr.Total%(5*1024*1024) == 0 {
		fmt.Printf(".")
	}
	return n, err
}

// --- UPLOADER LOGIC ---

func startStreamUploader() {
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()
	var lastM3u8Time time.Time

	for range ticker.C {
		files, err := os.ReadDir(SegmentDir)
		if err != nil {
			log.Printf("ReadDir error: %v", err)
			continue
		}

		for _, entry := range files {
			filename := entry.Name()
			fullPath := filepath.Join(SegmentDir, filename)

			// Playlist
			if filename == "stream.m3u8" {
				info, err := entry.Info()
				if err != nil {
					continue
				}
				if info.ModTime().After(lastM3u8Time) {
					err := uploadFileToB2(fullPath, filename, "application/vnd.apple.mpegurl", "public, max-age=1, must-revalidate")
					if err == nil {
						lastM3u8Time = info.ModTime()
						log.Printf("Playlist updated")
					} else {
						log.Printf("Playlist Upload Failed: %v", err)
					}
				}
				continue
			}

			// Segments (.ts)
			if strings.HasSuffix(filename, ".ts") {
				log.Printf("Found completed segment: %s", filename)
				err := uploadFileToB2(fullPath, filename, "video/MP2T", "public, max-age=86400")
				if err == nil {
					log.Printf("Uploaded: %s", filename)
					os.Remove(fullPath)
				} else {
					log.Printf("Segment Upload Failed: %v", err)
				}
			}
		}
	}
}

func uploadFileToB2(localPath, key, contentType, cacheControl string) error {
	file, err := os.Open(localPath)
	if err != nil {
		return err
	}
	defer file.Close()

	_, err = s3Client.PutObject(&s3.PutObjectInput{
		Bucket:       aws.String(AppConfig.B2.BucketStream),
		Key:          aws.String(key),
		Body:         file,
		ContentType:  aws.String(contentType),
		CacheControl: aws.String(cacheControl),
	})
	return err
}

// --- DJ & FFmpeg LOGIC ---

func startSmartDJ(output *io.PipeWriter) {
	defer output.Close()
	songsSinceJingle := 0

	for {
		var folderToPlay string
		if songsSinceJingle >= 3 {
			folderToPlay = PrefixJingles
			songsSinceJingle = 0
			log.Println("\n>>> 🔔 Jingle Time")
		} else {
			folderToPlay = PrefixMusic
			songsSinceJingle++
			log.Println("\n>>> 🎵 Music Time")
		}

		files, err := fetchKeysFromPrefix(folderToPlay)
		if err != nil || len(files) == 0 {
			log.Printf("⚠️  No files in %s. Waiting...", folderToPlay)
			time.Sleep(5 * time.Second)
			continue
		}

		randomTrack := files[rand.Intn(len(files))]
		log.Printf("▶️  Playing: %s", randomTrack)

		err = streamFileToPipe(randomTrack, output)
		if err != nil {
			log.Printf("Error streaming: %v", err)
		}
	}
}

func streamFileToPipe(key string, pipe *io.PipeWriter) error {
	obj, err := s3Client.GetObject(&s3.GetObjectInput{
		Bucket: aws.String(AppConfig.B2.BucketProd),
		Key:    aws.String(key),
	})
	if err != nil {
		return err
	}
	defer obj.Body.Close()

	proxy := &ProgressReader{Reader: obj.Body}
	_, err = io.Copy(pipe, proxy)
	return err
}

func fetchKeysFromPrefix(prefix string) ([]string, error) {
	var keys []string
	resp, err := s3Client.ListObjectsV2(&s3.ListObjectsV2Input{
		Bucket: aws.String(AppConfig.B2.BucketProd),
		Prefix: aws.String(prefix),
	})
	if err != nil {
		return nil, err
	}
	for _, item := range resp.Contents {
		key := *item.Key
		if strings.HasSuffix(key, ".mp3") && key != prefix {
			keys = append(keys, key)
		}
	}
	return keys, nil
}

func startFFmpeg(input io.Reader) {
	args := []string{
		"-loglevel", "error",
		"-f", "mp3",
		"-fflags", "+genpts+discardcorrupt+igndts",
		"-re",
		"-i", "pipe:0",

		"-vn",
		"-map", "0:a:0",

		"-af", "aresample=async=1",
		"-c:a", "aac", "-b:a", "128k", "-ac", "2",

		"-f", "hls",
		"-hls_time", "4",
		"-hls_list_size", "15",
		"-hls_flags", "append_list+omit_endlist+temp_file",

		filepath.Join(SegmentDir, "stream.m3u8"),
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
