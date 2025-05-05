package handlers

import (
	"net/http"
	"path/filepath"
	"slices"
	"sort"
	"strings"

	"maps"

	"github.com/andevellicus/med-ex/internal/extractor"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

type SchemaHandler struct {
	Extractor     *extractor.ExtractorService
	Logger        *zap.Logger
	SchemaBaseDir string
}

func NewSchemaHandler(extractor *extractor.ExtractorService, logger *zap.Logger, schemaBaseDir string) *SchemaHandler {
	return &SchemaHandler{
		Extractor:     extractor,
		Logger:        logger.Named("SchemaHandler"),
		SchemaBaseDir: schemaBaseDir,
	}
}

// GetSchemas handles GET /api/schemas
func (h *SchemaHandler) GetSchemas(c *gin.Context) {
	schemaNames := h.Extractor.GetAvailableSchemas()
	h.Logger.Info("Responding with available schema names", zap.Int("count", len(schemaNames)))
	c.JSON(http.StatusOK, gin.H{"schemas": schemaNames})
}

// GetSchemaDetails handles GET /api/schemas/:schemaName/details
func (h *SchemaHandler) GetSchemaDetails(c *gin.Context) {
	schemaNames := c.QueryArray("schemas")
	if len(schemaNames) == 0 {
		h.Logger.Error("GetSchemaDetails called without 'schemas' parameter")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing 'schemas' in query"})
		return
	}

	combinedEntityNames := make(map[string]bool)
	availableSchemas := h.Extractor.GetAvailableSchemas()

	for _, schemaName := range schemaNames {
		// Basic sanitization (optional but good practice)
		cleanSchemaName := filepath.Base(schemaName)
		if cleanSchemaName != schemaName || strings.Contains(cleanSchemaName, "..") {
			h.Logger.Warn("Skipping invalid schema name in details request", zap.String("original", schemaName), zap.String("cleaned", cleanSchemaName))
			continue // Skip invalid names
		}

		// Check if schema exists before trying to process
		if !slices.Contains(availableSchemas, cleanSchemaName) {
			h.Logger.Warn("Requested schema for details not found", zap.String("schemaName", cleanSchemaName))
			continue // Skip non-existent schemas
		}

		schemaData, found := h.getSchemaByName(cleanSchemaName) // Use cleaned name
		if !found {
			// This check might be redundant if the check above is done, but keep for safety
			h.Logger.Warn("Schema not found when getting details", zap.String("schemaName", cleanSchemaName))
			continue
		}

		// Flatten keys for the current schema
		// Ensure schemaData is map[string]any before passing
		schemaInterfaceMap := make(map[string]any, len(schemaData))
		maps.Copy(schemaInterfaceMap, schemaData) // Convert extractor.Schema to map[string]any

		entityNames := flattenSchemaEntityNames(schemaInterfaceMap, "") // Pass the converted map

		// Add to combined map (ensures uniqueness)
		for _, entityName := range entityNames {
			combinedEntityNames[entityName] = true
		}
	}

	// Convert map keys back to a slice
	finalEntityList := make([]string, 0, len(combinedEntityNames))
	for entityName := range combinedEntityNames {
		finalEntityList = append(finalEntityList, entityName)
	}

	sort.Strings(finalEntityList) // Sort for consistent order

	h.Logger.Info("Returning combined entity names", zap.Int("count", len(finalEntityList)), zap.Strings("schemas", schemaNames))
	c.JSON(http.StatusOK, gin.H{"entityNames": finalEntityList})
}

func (h *SchemaHandler) getSchemaByName(name string) (extractor.Schema, bool) {
	schema, found := h.Extractor.Schemas[name]
	// Return a copy? Deep copy might be needed if modifications are possible elsewhere
	// For now, returning direct reference assuming read-only usage in handler.
	return schema, found
}

func flattenSchemaEntityNames(data map[string]any, prefix string) []string {
	entityNames := []string{}
	seen := make(map[string]bool) // Track seen keys

	var recurse func(subData map[string]any, currentPrefix string)
	recurse = func(subData map[string]any, currentPrefix string) {
		for key, value := range subData {
			// Ensure key is a string (yaml.v3 usually does this, but good practice)
			stringKey := key
			if strings.HasPrefix(stringKey, "_") {
				continue
			} // Skip internal keys

			fullKey := stringKey
			if currentPrefix != "" {
				fullKey = currentPrefix + "." + stringKey
			}

			// Check if the value is a map
			valueMap, isMap := convertToMapStringInterface(value)

			isPotentiallyAnEntity := false
			shouldRecurseIntoProperties := false
			var propertiesMap map[string]any

			if isMap {
				// Check for 'properties' key specifically
				propsInterface, hasPropsKey := valueMap["properties"]
				if hasPropsKey {
					// Check if 'properties' value is actually a map
					props, propsIsMap := propsInterface.(map[string]any)
					if propsIsMap {
						shouldRecurseIntoProperties = true
						propertiesMap = props
					}
				}

				// Check for standard definition keys (type, description, items)
				_, hasType := valueMap["type"]
				_, hasDescription := valueMap["description"]
				_, hasItems := valueMap["items"]

				// It's an entity if it has definition keys AND we are NOT recursing into properties
				if (hasType || hasDescription || hasItems) && !shouldRecurseIntoProperties {
					isPotentiallyAnEntity = true
				}

				// If it only has properties, it's structural (like "Labs")
				if hasPropsKey && !(hasType || hasDescription || hasItems) {
					isPotentiallyAnEntity = false
				}

			} else {
				// Value is not a map. Treat as entity leaf ONLY if nested.
				if currentPrefix != "" {
					isPotentiallyAnEntity = true
				}
			}

			// --- Decision ---
			if shouldRecurseIntoProperties {
				recurse(propertiesMap, fullKey)
			} else if isPotentiallyAnEntity {
				if !seen[fullKey] {
					entityNames = append(entityNames, fullKey)
					seen[fullKey] = true
				}
			}
			// else: Skip structural maps without properties, skip top-level non-entities
		}
	}

	recurse(data, prefix)
	return entityNames
}

// Recursive helper function to handle various map types from YAML
// Converts map[any]any or map[string]any to map[string]any
// Returns the converted map and true if conversion was successful, otherwise nil and false.
func convertToMapStringInterface(input any) (map[string]any, bool) {
	if input == nil {
		return nil, false
	}

	// If it's already the target type, return it (recursively check values)
	if msi, ok := input.(map[string]any); ok {
		result := make(map[string]any, len(msi))
		for k, v := range msi {
			convertedValue, convertedOK := convertToMapStringInterface(v) // Recurse on value
			if convertedOK {
				result[k] = convertedValue
			} else {
				result[k] = v // Keep original if not a convertible map
			}
		}
		return result, true
	}

	// If it's map[any]any, convert keys and recurse on values
	if mii, ok := input.(map[any]any); ok {
		result := make(map[string]any, len(mii))
		for k, v := range mii {
			ks, keyIsString := k.(string)
			if !keyIsString {
				return nil, false
			} // Key must be string

			convertedValue, convertedOK := convertToMapStringInterface(v) // Recurse on value
			if convertedOK {
				result[ks] = convertedValue
			} else {
				result[ks] = v // Keep original if not a convertible map
			}
		}
		return result, true
	}

	// Add conversion for the specific named type extractor.Schema if necessary,
	// though ideally this is handled before the first call to recurse.
	// This handles cases where a value *within* the map might also be extractor.Schema
	if es, ok := input.(extractor.Schema); ok {
		result := make(map[string]any, len(es))
		for k, v := range es {
			convertedValue, convertedOK := convertToMapStringInterface(v) // Recurse on value
			if convertedOK {
				result[k] = convertedValue
			} else {
				result[k] = v // Keep original if not a convertible map
			}
		}
		return result, true
	}

	// Not a convertible map type
	return nil, false
}
