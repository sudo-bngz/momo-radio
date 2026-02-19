package config

import (
	"log"
	"strings"

	"github.com/spf13/viper"
)

type Config struct {
	Storage struct {
		Provider     string `mapstructure:"provider"` // "s3", "local", "gdrive"
		KeyID        string `mapstructure:"key_id"`   // S3 Access Key / B2 KeyID
		AppKey       string `mapstructure:"app_key"`  // S3 Secret Key / B2 AppKey
		Endpoint     string `mapstructure:"endpoint"`
		Region       string `mapstructure:"region"`
		BucketIngest string `mapstructure:"bucket_ingest"`
		BucketProd   string `mapstructure:"bucket_prod"`
		BucketStream string `mapstructure:"bucket_stream_live"`
		LocalStorage string `mapstructure:"local_storage_path"` // For local provider
	} `mapstructure:"storage"`
	Server struct {
		TempDir         string `mapstructure:"temp_dir"`
		PollingInterval int    `mapstructure:"polling_interval_seconds"`
		MetricsPort     string `mapstructure:"metrics_port"`
	} `mapstructure:"server"`
	Radio struct {
		Bitrate       string `mapstructure:"bitrate"`
		SegmentTime   string `mapstructure:"segment_time"`
		ListSize      string `mapstructure:"list_size"`
		SegmentDir    string `mapstructure:"segment_dir"`
		LogLevel      string `mapstructure:"log_level"`
		InputFormat   string `mapstructure:"input_format"`
		FFlags        string `mapstructure:"fflags"`
		AudioFilter   string `mapstructure:"audio_filter"`
		AudioCodec    string `mapstructure:"audio_codec"`
		AudioChannels string `mapstructure:"audio_channels"`
		HLSFlags      string `mapstructure:"hls_flags"`
		PrefetchCount int    `mapstructure:"prefetch_count"`
		DryRun        bool   `mapstructure:"dry_run"`
		Provider      string `mapstructure:"provider"`
	} `mapstructure:"radio"`
	Database struct {
		Host     string `mapstructure:"host"`
		Port     string `mapstructure:"port"`
		User     string `mapstructure:"user"`
		Password string `mapstructure:"password"`
		Name     string `mapstructure:"name"`
	} `mapstructure:"database"`
	Services struct {
		DiscogsToken string `mapstructure:"discogs_token"`
		ContactEmail string `mapstructure:"contact_email"`
	} `mapstructure:"services"`
}

func Load() *Config {
	viper.SetEnvPrefix("RADIO")
	viper.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	viper.AutomaticEnv()

	// Storage Bindings
	viper.BindEnv("storage.provider")
	viper.BindEnv("storage.key_id")
	viper.BindEnv("storage.app_key")
	viper.BindEnv("storage.endpoint")
	viper.BindEnv("storage.region")
	viper.BindEnv("storage.bucket_ingest")
	viper.BindEnv("storage.bucket_prod")
	viper.BindEnv("storage.bucket_stream_live")
	viper.BindEnv("storage.local_storage_path")

	viper.BindEnv("server.temp_dir")
	viper.BindEnv("server.polling_interval_seconds")
	viper.BindEnv("server.metrics_port")

	// Radio Config Bindings
	viper.BindEnv("radio.bitrate")
	viper.BindEnv("radio.segment_time")
	viper.BindEnv("radio.list_size")
	viper.BindEnv("radio.segment_dir")
	viper.BindEnv("radio.log_level")
	viper.BindEnv("radio.input_format")
	viper.BindEnv("radio.fflags")
	viper.BindEnv("radio.audio_filter")
	viper.BindEnv("radio.audio_codec")
	viper.BindEnv("radio.audio_channels")
	viper.BindEnv("radio.hls_flags")
	viper.BindEnv("radio.prefetch_count")
	viper.BindEnv("radio.provider")

	// Defaults
	viper.SetDefault("server.polling_interval_seconds", 10)
	viper.SetDefault("server.temp_dir", "/tmp/")
	viper.SetDefault("server.metrics_port", ":9091")

	// Register Database keys
	viper.BindEnv("database.host")
	viper.BindEnv("database.port")
	viper.BindEnv("database.user")
	viper.BindEnv("database.password")
	viper.BindEnv("database.name")

	// Services
	viper.BindEnv("services.discogs_token")
	viper.BindEnv("services.contact_email")

	// Radio Defaults (Optimized for Live HLS)
	viper.SetDefault("radio.bitrate", "128k")
	viper.SetDefault("radio.segment_time", "4")
	viper.SetDefault("radio.list_size", "15") // 60s buffer
	viper.SetDefault("radio.segment_dir", "./hls_output")
	viper.SetDefault("radio.log_level", "error")
	viper.SetDefault("radio.input_format", "mp3")
	viper.SetDefault("radio.fflags", "+genpts+discardcorrupt+igndts")
	viper.SetDefault("radio.audio_filter", "aresample=async=1")
	viper.SetDefault("radio.audio_codec", "aac")
	viper.SetDefault("radio.audio_channels", "2")
	viper.SetDefault("radio.hls_flags", "append_list+omit_endlist+temp_file")
	viper.SetDefault("radio.prefetch_count", 5)
	viper.SetDefault("radio.provider", "starvation")

	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath(".")
	viper.AddConfigPath("../")

	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			log.Printf("Warning: Config error: %s", err)
		} else {
			log.Println("Info: config.yaml not found, using Environment Variables only.")
		}
	}

	var cfg Config
	if err := viper.Unmarshal(&cfg); err != nil {
		log.Fatalf("Unable to decode config: %v", err)
	}

	validateConfig(&cfg)

	return &cfg
}

func validateConfig(cfg *Config) {
	if cfg.Storage.Provider == "s3" && cfg.Storage.KeyID == "" {
		log.Fatal("Critical: S3/B2 KeyID is missing (RADIO_STORAGE_KEY_ID)")
	}
	if cfg.Storage.Provider == "local" && cfg.Storage.LocalStorage == "" {
		log.Fatal("Critical: Local storage path is missing (RADIO_STORAGE_LOCAL_STORAGE_PATH)")
	}
}
