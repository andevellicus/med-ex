package extractor

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"go.uber.org/zap"
	"gopkg.in/yaml.v3"
)

type Schema map[string]any

// loadSchema loads a single YAML file using yaml.v3
func loadSchema(schemaPath string) (Schema, error) {
	yamlFile, err := os.ReadFile(schemaPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read schema file %s: %w", schemaPath, err)
	}

	var schema Schema
	// Use yaml.v3 Unmarshal (no .UnmarshalStrict needed here unless desired for other reasons)
	// v3 defaults to map[string]interface{} for nested maps when target is interface{}
	err = yaml.Unmarshal(yamlFile, &schema)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal schema YAML from %s: %w", schemaPath, err)
	}
	if schema == nil {
		return nil, fmt.Errorf("schema unmarshalled to nil map for %s", schemaPath)
	}

	// No conversion or JSON round-trip needed!
	return schema, nil
}

// loadSchemasFromDir loads all YAML files from a directory
func loadSchemasFromDir(dirPath string, logger *zap.Logger) (map[string]Schema, []string, error) {
	schemas := make(map[string]Schema)
	var schemaNames []string

	// Check if directory exists
	if _, err := os.Stat(dirPath); os.IsNotExist(err) {
		logger.Error("Schema directory does not exist", zap.String("path", dirPath))
		return nil, nil, fmt.Errorf("schema directory not found: %s", dirPath)
	}

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

// GetSchemaDefinitionByName retrieves the definition of a specific schema.
func (s *ExtractorService) GetSchemaDefinitionByName(schemaName string) (Schema, bool) {
	schema, exists := s.schemas[schemaName]
	// Return a copy or the original based on whether you need isolation
	// For now, returning the original map reference is likely fine.
	return schema, exists
}
