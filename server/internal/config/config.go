package config

import (
	"fmt"
	"strings"

	"github.com/spf13/viper"
)

// Config holds the application configuration.
type Config struct {
	Server struct {
		Port string `mapstructure:"port"`
	} `mapstructure:"server"`

	Log struct {
		Level      string `mapstructure:"level"`
		MaxSizeMB  int    `mapstructure:"max_size_mb"`
		MaxBackups int    `mapstructure:"max_backups"`
		MaxAgeDays int    `mapstructure:"max_age_days"`
		Compress   bool   `mapstructure:"compress"`
		LogDir     string `mapstructure:"log_dir"`
	} `mapstructure:"log"`

	LLM struct {
		ServerURL string `mapstructure:"server"`
		SchemaDir string `mapstructure:"schema_dir"`
	} `mapstructure:"llm"`

	Results struct {
		Dir string `mapstructure:"dir"`
	} `mapstructure:"results"`
}

// NewDefaultConfig returns a Config struct with default values.
func NewDefaultConfig() *Config {
	return &Config{
		Server: struct {
			Port string `mapstructure:"port"`
		}{
			Port: "8080",
		},
		Log: struct {
			Level      string `mapstructure:"level"`
			MaxSizeMB  int    `mapstructure:"max_size_mb"`
			MaxBackups int    `mapstructure:"max_backups"`
			MaxAgeDays int    `mapstructure:"max_age_days"`
			Compress   bool   `mapstructure:"compress"`
			LogDir     string `mapstructure:"log_dir"`
		}{
			Level:      "info",
			MaxSizeMB:  100,
			MaxBackups: 5,
			MaxAgeDays: 30,
			Compress:   true,
			LogDir:     "./logs",
		},
		LLM: struct {
			ServerURL string "mapstructure:\"server\""
			SchemaDir string `mapstructure:"schema_dir"`
		}{
			ServerURL: "http://127.0.0.1:5000",
			SchemaDir: "config/",
		},
		Results: struct {
			Dir string `mapstructure:"dir"`
		}{
			Dir: "./results",
		},
	}
}

// LoadConfig loads the application configuration from the specified file.
func LoadConfig(configPath string) (*Config, error) {
	cfg := NewDefaultConfig() // Load default values

	if configPath != "" { // Only configure Viper if a path is provided
		viper.SetConfigFile(configPath)
		viper.SetConfigType("yaml")
	} else {
		// Optionally set defaults or search paths if no config file is mandatory
		// For now, we rely on the defaults set in NewDefaultConfig
		fmt.Println("Warning: No configuration file path provided, using default values.")
	}

	viper.AutomaticEnv() // Read in environment variables that match

	// Replace environment variable prefixes (e.g., APP_) with the nested structure
	viper.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))

	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); ok {
			fmt.Printf("Warning: Configuration file not found at: %s, using default values and environment variables\n", configPath)
			// Default values are already loaded, just continue
		} else {
			return nil, fmt.Errorf("failed to read config file: %w", err)
		}
	}

	if err := viper.Unmarshal(cfg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	return cfg, nil
}
