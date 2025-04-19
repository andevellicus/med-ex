package extractor

import (
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/andevellicus/webapp/internal/config"
	"go.uber.org/zap"
	"gopkg.in/yaml.v2"
)

type Schema map[string]any

// ExtractorService holds dependencies
type ExtractorService struct {
	llmServerURL string
	httpClient   *http.Client
	logger       *zap.Logger
	schemas      map[string]Schema
	schemaNames  []string
}

func NewExtractorService(cfg *config.Config, logger *zap.Logger, projectRoot string) (*ExtractorService, error) {
	llmURL := cfg.LLM.ServerURL
	schemasDir := filepath.Join(projectRoot, cfg.LLM.SchemaDir) // Use absolute path

	// Validate URL format
	_, err := url.ParseRequestURI(llmURL)
	if err != nil {
		logger.Error("Invalid LLM Server URL configured", zap.String("url", llmURL), zap.Error(err))
		return nil, fmt.Errorf("invalid llm server url: %w", err)
	}

	// Load Schemas from directory
	schemas, schemaNames, err := loadSchemasFromDir(schemasDir, logger)
	if err != nil {
		logger.Error("Failed to load schemas", zap.String("directory", schemasDir), zap.Error(err))
		return nil, fmt.Errorf("failed to load schemas from %s: %w", schemasDir, err)
	}
	if len(schemas) == 0 {
		logger.Error("No schemas found in directory", zap.String("directory", schemasDir))
	}

	return &ExtractorService{
		llmServerURL: llmURL,
		httpClient: &http.Client{
			Timeout: 90 * time.Second,
		},
		logger:      logger.Named("extractor"), // Keep logger instance in service
		schemas:     schemas,
		schemaNames: schemaNames,
	}, nil
}

// loadSchemasFromDir loads all YAML files from a directory
func loadSchemasFromDir(dirPath string, logger *zap.Logger) (map[string]Schema, []string, error) {
	schemas := make(map[string]Schema)
	var schemaNames []string

	files, err := os.ReadDir(dirPath)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to read schema directory %s: %w", dirPath, err)
	}

	for _, file := range files {
		if file.IsDir() {
			continue // Skip subdirectories
		}

		fileName := file.Name()
		if strings.HasSuffix(fileName, ".yaml") || strings.HasSuffix(fileName, ".yml") {
			filePath := filepath.Join(dirPath, fileName)
			schemaData, err := loadSchema(filePath)
			if err != nil {
				logger.Warn("Failed to load or parse schema file, skipping.",
					zap.String("file", fileName),
					zap.String("path", filePath),
					zap.Error(err))
				continue // Skip this file and continue with others
			}
			// Use filename without extension as the schema name
			schemaName := strings.TrimSuffix(fileName, filepath.Ext(fileName))
			schemas[schemaName] = schemaData
			schemaNames = append(schemaNames, schemaName)
		}
	}
	// Sort names alphabetically for consistent listing
	sort.Strings(schemaNames)
	return schemas, schemaNames, nil
}

// loadSchema loads a single YAML file (keep this function)
func loadSchema(schemaPath string) (Schema, error) {
	yamlFile, err := os.ReadFile(schemaPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read schema file: %w", err)
	}

	var schema Schema
	err = yaml.Unmarshal(yamlFile, &schema)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal schema YAML: %w", err)
	}
	return schema, nil
}

// GetAvailableSchemas returns the list of loaded schema names
func (s *ExtractorService) GetAvailableSchemas() []string {
	// Return a copy to prevent external modification
	names := make([]string, len(s.schemaNames))
	copy(names, s.schemaNames)
	return names
}
