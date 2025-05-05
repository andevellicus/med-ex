package extractor

import (
	"fmt"
	"maps"
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
func loadSchemasFromDir(dirPath string, logger *zap.Logger) (map[string]Schema, []string, map[string]string, error) {
	schemas := make(map[string]Schema)
	schemaFiles := make(map[string]string) // Map name to file path
	var schemaNames []string

	if _, err := os.Stat(dirPath); os.IsNotExist(err) {
		logger.Error("Schema directory does not exist", zap.String("path", dirPath))
		// Return empty maps/slice but not necessarily an error, depends on requirements
		return nil, nil, nil, fmt.Errorf("schema directory not found: %s", dirPath)
	}

	files, err := os.ReadDir(dirPath)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("failed to read schema directory %s: %w", dirPath, err)
	}

	for _, file := range files {
		if file.IsDir() {
			continue
		}

		fileName := file.Name()
		if strings.HasSuffix(strings.ToLower(fileName), ".yaml") || strings.HasSuffix(strings.ToLower(fileName), ".yml") {
			filePath := filepath.Join(dirPath, fileName)
			schemaData, err := loadSchema(filePath)
			if err != nil {
				logger.Warn("Failed to load or parse schema file, skipping.",
					zap.String("file", fileName), zap.String("path", filePath), zap.Error(err))
				continue
			}

			schemaName := strings.TrimSuffix(fileName, filepath.Ext(fileName))
			// Handle potential duplicate schema names (e.g., file.yaml and file.YAML)
			if _, exists := schemas[schemaName]; exists {
				logger.Warn("Duplicate schema name detected, overwriting previous definition.",
					zap.String("schemaName", schemaName), zap.String("newFilePath", filePath))
			}

			schemas[schemaName] = schemaData
			schemaFiles[schemaName] = filePath // Store the path
			// Only add name to list if it's not already there (handles overwrite case)
			found := false
			for _, name := range schemaNames {
				if name == schemaName {
					found = true
					break
				}
			}
			if !found {
				schemaNames = append(schemaNames, schemaName)
			}

		}
	}
	sort.Strings(schemaNames) // Sort names after collecting all unique ones
	return schemas, schemaNames, schemaFiles, nil
}

// Simple merge strategy: last schema wins on key conflict.
func (s *ExtractorService) CombineSchemas(schemaNames []string) (Schema, error) {
	combined := make(Schema)
	s.logger.Debug("Combining schemas", zap.Strings("names", schemaNames))

	if len(schemaNames) == 0 {
		return nil, fmt.Errorf("no schema names provided for combination")
	}

	for _, name := range schemaNames {
		schema, exists := s.Schemas[name]
		if !exists {
			s.logger.Error("Schema not found during combination", zap.String("name", name))
			return nil, fmt.Errorf("schema '%s' not found", name)
		}
		// Merge schema into combined. Later schemas overwrite existing keys.
		maps.Copy(combined, schema)
		s.logger.Debug("Merged schema", zap.String("name", name), zap.Int("keys_in_schema", len(schema)), zap.Int("total_keys_now", len(combined)))
	}

	// Optionally, sort keys for consistent output (might help LLM)
	sortedKeys := make([]string, 0, len(combined))
	for k := range combined {
		sortedKeys = append(sortedKeys, k)
	}
	sort.Strings(sortedKeys)
	sortedCombined := make(Schema, len(combined))
	for _, k := range sortedKeys {
		sortedCombined[k] = combined[k]
	}

	s.logger.Info("Successfully combined schemas", zap.Int("count", len(schemaNames)), zap.Int("total_unique_keys", len(sortedCombined)))
	return sortedCombined, nil // Return sorted
}
