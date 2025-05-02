package handlers

import (
	"fmt"
	"net/http"
	"sort"
	"strings"

	"maps"

	"github.com/andevellicus/med-ex/internal/extractor"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

type SchemaHandler struct {
	Extractor *extractor.ExtractorService
	Logger    *zap.Logger
}

func NewSchemaHandler(extractor *extractor.ExtractorService, logger *zap.Logger) *SchemaHandler {
	return &SchemaHandler{
		Extractor: extractor,
		Logger:    logger.Named("SchemaHandler"),
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
	schemaName := c.Param("schemaName")
	if schemaName == "" {
		h.Logger.Error("Missing schemaName path parameter")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing schema name in path"})
		return
	}

	// Get the specific schema structure from the extractor service
	// We need to add a method to ExtractorService to retrieve a single schema by name
	schemaData, found := h.getSchemaByName(schemaName)
	if !found {
		h.Logger.Error("Schema not found", zap.String("schemaName", schemaName))
		c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("Schema '%s' not found", schemaName)})
		return
	}
	// *** Convert extractor.Schema (map[string]any) to map[string]any ***
	// This step is crucial to match the function signature AND allows the first level keys to be processed correctly
	schemaInterfaceMap := make(map[string]any, len(schemaData))
	maps.Copy(schemaInterfaceMap, schemaData)

	// Flatten the keys
	entityNames := flattenSchemaEntityNames(schemaData, "")
	sort.Strings(entityNames) // Sort for consistent order

	c.JSON(http.StatusOK, gin.H{"entityNames": entityNames})
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
