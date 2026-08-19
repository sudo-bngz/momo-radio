package config

import (
	"log"
	"strings"

	"github.com/spf13/viper"
)

type Config struct {
	Storage struct {
		Provider         string `mapstructure:"provider"`
		KeyID            string `mapstructure:"key_id"`
		AppKey           string `mapstructure:"app_key"`
		Endpoint         string `mapstructure:"endpoint"`
		Region           string `mapstructure:"region"`
		BucketIngest     string `mapstructure:"bucket_assets"`
		BucketAssets     string `mapstructure:"bucket_prod"`
		BucketStream     string `mapstructure:"bucket_stream_live"`
		BucketMaster     string `mapstructure:"bucket_master"`
		BucketPublicPage string `mapstructure:"bucket_public_page"`
		LocalStorage     string `mapstructure:"local_storage_path"`
	} `mapstructure:"storage"`
	CDN struct {
		Enabled    bool   `mapstructure:"enabled"`
		Stream     string `mapstructure:"stream"`
		Master     string `mapstructure:"master"`
		PublicPage string `mapstructure:"public_page"`
		Assets     string `mapstructure:"assets"`
	} `mapstructure:"cdn"`
	Server struct {
		TempDir         string `mapstructure:"temp_dir"`
		PollingInterval int    `mapstructure:"polling_interval_seconds"`
		MetricsPort     string `mapstructure:"metrics_port"`
		Timezone        string `mapstructure:"timezone"`
	} `mapstructure:"server"`
	Radio struct {
		PublicDomain  string `mapstructure:"public_domain"`
		Bitrate       string `mapstructure:"bitrate"`
		SampleRate    string `mapstructure:"sample_rate"`
		SegmentTime   int    `mapstructure:"segment_time"`
		ListSize      int    `mapstructure:"list_size"`
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
	Redis struct {
		Host     string `mapstructure:"host"`
		Port     string `mapstructure:"port"`
		Password string `mapstructure:"password"`
		DB       int    `mapstructure:"db"`
		TLS      bool   `mapstructure:"tls"`
	} `mapstructure:"redis"`
	Services struct {
		DiscogsToken string `mapstructure:"discogs_token"`
		ContactEmail string `mapstructure:"contact_email"`
		AcoustIDKey  string `mapstructure:"acoustid_key"`
	} `mapstructure:"services"`
	Worker struct {
		Concurrency             int            `mapstructure:"concurrency"`
		Queues                  map[string]int `mapstructure:"queues"`
		DelayedCheckIntervalSec int            `mapstructure:"delayed_check_interval_sec"`
		HealthCheckIntervalSec  int            `mapstructure:"health_check_interval_sec"`
		RedisPoolSize           int            `mapstructure:"redis_pool_size"`
	} `mapstructure:"worker"`
	Supabase struct {
		JWTPublicKey string `mapstructure:"jwt_public_key"`
	} `mapstructure:"supabase"`
	Stripe struct {
		SecretKey     string
		WebhookSecret string
		ProPriceID    string // Injected from Terraform outputs
		SuccessURL    string // e.g., https://momosbasement.com/settings/billing?success=true
		CancelURL     string
	}
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
	viper.BindEnv("storage.bucket_assets")
	viper.BindEnv("storage.bucket_stream_live")
	viper.BindEnv("storage.bucket_master")
	viper.BindEnv("storage.bucket_public_page")
	viper.BindEnv("storage.local_storage_path")

	// Split CDN Bindings
	viper.BindEnv("cdn.enabled")
	viper.BindEnv("cdn.stream")
	viper.BindEnv("cdn.master")
	viper.BindEnv("cdn.public_page")
	viper.BindEnv("cdn.assets")

	// Server Bindings
	viper.BindEnv("server.temp_dir")
	viper.BindEnv("server.polling_interval_seconds")
	viper.BindEnv("server.metrics_port")
	viper.BindEnv("server.timezone")

	// Radio Config Bindings
	viper.BindEnv("radio.public_domain")
	viper.BindEnv("radio.bitrate")
	viper.BindEnv("radio.sample_rate")
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

	// Infrastructure Bindings
	viper.BindEnv("database.host")
	viper.BindEnv("database.port")
	viper.BindEnv("database.user")
	viper.BindEnv("database.password")
	viper.BindEnv("database.name")

	viper.BindEnv("redis.host")
	viper.BindEnv("redis.port")
	viper.BindEnv("redis.password")
	viper.BindEnv("redis.db")
	viper.BindEnv("redis.tls")

	viper.BindEnv("services.discogs_token")
	viper.BindEnv("services.contact_email")
	viper.BindEnv("services.acoustid_key")

	viper.BindEnv("worker.concurrency")
	viper.BindEnv("supabase.jwt_public_key", "SUPABASE_JWT_PUBLIC_KEY")

	// Defaults
	viper.SetDefault("server.polling_interval_seconds", 10)
	viper.SetDefault("server.temp_dir", "/tmp/")
	viper.SetDefault("server.metrics_port", ":9091")
	viper.SetDefault("server.timezone", "UTC")

	// CDN Defaults
	viper.SetDefault("cdn.enabled", false)
	viper.SetDefault("cdn.stream", "")
	viper.SetDefault("cdn.master", "")
	viper.SetDefault("cdn.public_page", "")
	viper.SetDefault("cdn.assets", "")

	viper.SetDefault("redis.host", "localhost")
	viper.SetDefault("redis.port", "6379")
	viper.SetDefault("redis.password", "")
	viper.SetDefault("redis.db", 0)
	viper.SetDefault("redis.tls", false)

	// Radio Defaults
	viper.SetDefault("radio.public_domain", "momo.radio")
	viper.SetDefault("radio.bitrate", "128k")
	viper.SetDefault("radio.sample_rate", "44100")
	viper.SetDefault("radio.segment_time", 4)
	viper.SetDefault("radio.list_size", 15)
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
	viper.SetDefault("radio.dry_run", false)

	viper.SetDefault("worker.concurrency", 6)
	viper.SetDefault("worker.queues", map[string]int{
		"default": 10,
		"ingest":  7,
		"exports": 3,
	})
	viper.SetDefault("worker.delayed_check_interval_sec", 15)
	viper.SetDefault("worker.health_check_interval_sec", 30)
	viper.SetDefault("worker.redis_pool_size", 10)

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
	if cfg.Supabase.JWTPublicKey == "" {
		log.Fatal("Critical: Supabase JWT Public Key is missing (SUPABASE_JWT_PUBLIC_KEY)")
	}
	if cfg.Storage.Provider == "s3" && cfg.Storage.BucketPublicPage == "" {
		log.Fatal("Critical: Public Page bucket is missing (RADIO_STORAGE_BUCKET_PUBLIC_PAGE)")
	}

	// Comprehensive CDN Field Validation
	if cfg.CDN.Enabled {
		if cfg.CDN.Stream == "" {
			log.Fatal("Critical: CDN is enabled but Stream CDN URL is missing (RADIO_CDN_STREAM)")
		}
		if cfg.CDN.Master == "" {
			log.Fatal("Critical: CDN is enabled but Master CDN URL is missing (RADIO_CDN_MASTER)")
		}
		if cfg.CDN.PublicPage == "" {
			log.Fatal("Critical: CDN is enabled but Public Page CDN URL is missing (RADIO_CDN_PUBLIC_PAGE)")
		}
		if cfg.CDN.Assets == "" {
			log.Fatal("Critical: CDN is enabled but Assets CDN URL is missing (RADIO_CDN_ASSETS)")
		}
	}
}
