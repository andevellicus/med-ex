package extractor

import (
	"fmt"
	"net/http"
	"net/url"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/andevellicus/webapp/internal/config"
	"go.uber.org/zap"
)

// Position defines the start and end indices of a span in the text.
type Position struct {
	Start int `json:"start"`
	End   int `json:"end"`
}

// Context holds the text surrounding an entity and its position.
type Context struct {
	Text     string   `json:"text"`
	Position Position `json:"position"`
}

// EntityOccurrence represents a single extracted instance of an entity type.
type EntityOccurrence struct {
	// Value can be string, number, bool, or even a slice based on schema.
	// Using 'any' (interface{}) provides flexibility.
	Value    any      `json:"value"`
	Position Position `json:"position"` // Position of the Value in the original text
	Context  Context  `json:"context"`  // Surrounding context and its position
}

// ExtractionOutput maps an entity name (e.g., "Age", "Vital signs.Temperature")
// to a slice of all occurrences found for that entity.
type ExtractionOutput map[string][]EntityOccurrence

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

// ExtractEntities processes text content using the specified schema
func (s *ExtractorService) ExtractEntities(schemaName string, content string) (map[string]any, error) {
	// Check if schema exists
	_, exists := s.schemas[schemaName]
	if !exists {
		return nil, fmt.Errorf("schema '%s' not found", schemaName)
	}

	// In a real implementation, you would:
	// 1. Prepare the content (normalize, clean, etc.)
	// 2. Send to LLM service with the schema
	// 3. Process and format the response

	// For now, return a mock response
	mockResult := map[string]any{
		"normalized_text": content,
		"extracted_data": map[string]any{
			"entities": []map[string]any{
				{
					"type":  "placeholder",
					"value": "Sample Entity",
				},
			},
		},
		"entity_positions": map[string]any{
			"placeholder": [][]int{{0, 13}},
		},
		"context_positions": map[string]any{},
	}

	s.logger.Info("Entity extraction completed",
		zap.String("schema", schemaName),
		zap.Int("content_length", len(content)))

	return mockResult, nil
}

// GetAvailableSchemas returns the list of loaded schema names //TODO evaluate if we need this
func (s *ExtractorService) GetAvailableSchemas() []string {
	// Return a copy to prevent external modification
	names := make([]string, len(s.schemaNames))
	copy(names, s.schemaNames)
	return names
}

// ProcessText orchestrates the extraction process for a given text and schema.
func (s *ExtractorService) ProcessText(schemaName string, text string) (ExtractionOutput, error) {
	s.logger.Info("Starting extraction process",
		zap.String("schemaName", schemaName),
		zap.Int("textLength", len(text)),
	)

	// Step 0: Normalize text (like Python version)
	// Replace Windows CRLF and standalone CR with Unix LF for consistency
	normalizedText := strings.ReplaceAll(text, "\r\n", "\n")
	normalizedText = strings.ReplaceAll(normalizedText, "\r", "\n")
	s.logger.Debug("Text normalized", zap.Int("normalizedLength", len(normalizedText)))

	// Step 1: Format the prompt
	prompt, err := s.formatExtractionPrompt(schemaName, normalizedText)
	if err != nil {
		// Error already logged in formatExtractionPrompt
		return nil, fmt.Errorf("failed during prompt formatting: %w", err)
	}

	// Step 2: Call the LLM
	llmResponseString, err := s.callLLM(prompt)
	if err != nil {
		// Error already logged in callLLM
		return nil, fmt.Errorf("failed during LLM call: %w", err)
	}
	if llmResponseString == "" {
		s.logger.Error("LLM call returned an empty response string")
		return nil, fmt.Errorf("LLM call returned an empty response")
	}

	// Step 3: Parse the LLM's JSON response
	rawExtraction, err := s.parseLLMResponse(llmResponseString)
	if err != nil {
		// Error already logged in parseLLMResponse
		return nil, fmt.Errorf("failed during LLM response parsing: %w", err)
	}

	// Step 4: Find entity positions
	finalOutput, err := s.findEntityPositions(normalizedText, rawExtraction)
	if err != nil {
		// Error potentially logged in findEntityPositions, but add context here
		s.logger.Error("Failed during entity position finding", zap.Error(err))
		return nil, fmt.Errorf("failed during position finding: %w", err)
	}

	s.logger.Info("Extraction process completed successfully",
		zap.String("schemaName", schemaName),
		zap.Int("finalEntityCount", len(finalOutput)), // Count top-level entities
	)
	return finalOutput, nil
}

// findEntityPositions locates the extracted values and contexts in the text.
func (s *ExtractorService) findEntityPositions(normalizedText string, rawExtraction RawLLMExtraction) (ExtractionOutput, error) {
	finalOutput := make(ExtractionOutput)
	textLength := len(normalizedText) // Cache text length for bounds checking

	s.logger.Info("Starting position finding process")

	for entityName, occurrences := range rawExtraction {
		if len(occurrences) == 0 {
			continue // Skip if LLM returned empty list for this entity
		}

		// Ensure slice exists in the final output map
		if _, exists := finalOutput[entityName]; !exists {
			finalOutput[entityName] = []EntityOccurrence{}
		}

		for _, occurrence := range occurrences {
			// Handle potential nil values from JSON parsing (if LLM returns null)
			if occurrence.Value == nil || occurrence.Context == "" {
				s.logger.Warn("Skipping occurrence with nil value or empty context", zap.String("entityName", entityName))
				continue
			}

			// Convert value to string for searching. Handle different types.
			var valueStr string
			switch v := occurrence.Value.(type) {
			case string:
				valueStr = v
			case float64: // Numbers are often parsed as float64 from JSON
				// Check if it's actually an integer
				if v == float64(int(v)) {
					valueStr = fmt.Sprintf("%d", int(v))
				} else {
					valueStr = fmt.Sprintf("%f", v) // Or choose desired float format
				}
			case bool:
				valueStr = fmt.Sprintf("%t", v)
			default:
				// Fallback for other types (like lists, though less common for direct search)
				valueStr = fmt.Sprintf("%v", occurrence.Value)
				s.logger.Debug("Converted non-standard value type to string for search",
					zap.String("entityName", entityName),
					zap.Any("originalValue", occurrence.Value),
					zap.String("stringValue", valueStr),
				)
			}

			contextStr := occurrence.Context

			// Skip empty strings which would cause issues with regex/search
			if valueStr == "" || contextStr == "" {
				s.logger.Warn("Skipping occurrence with empty value or context string after conversion", zap.String("entityName", entityName))
				continue
			}

			// 1. Find all occurrences of the context string using regex
			foundInContext := false
			contextRegexStr := `(?i)` + regexp.QuoteMeta(contextStr) // Case-insensitive search for context
			contextRegex, err := regexp.Compile(contextRegexStr)
			if err != nil {
				s.logger.Error("Failed to compile context regex, skipping occurrence",
					zap.String("entityName", entityName),
					zap.String("context", contextStr),
					zap.Error(err),
				)
				continue
			}

			contextMatches := contextRegex.FindAllStringIndex(normalizedText, -1)

			if len(contextMatches) > 0 {
				valueRegexStr := `(?i)` + regexp.QuoteMeta(valueStr) // Case-insensitive search for value
				valueRegex, err := regexp.Compile(valueRegexStr)
				if err != nil {
					s.logger.Error("Failed to compile value regex, skipping context matches for this occurrence",
						zap.String("entityName", entityName),
						zap.String("value", valueStr),
						zap.Error(err),
					)
					// Continue to fallback search below if value regex fails
				} else {
					// For each context match, try to find the value *within* it
					for _, contextMatch := range contextMatches {
						contextStart, contextEnd := contextMatch[0], contextMatch[1]
						contextTextSpan := normalizedText[contextStart:contextEnd]

						// Find the first match of the value *within this specific context span*
						valueMatch := valueRegex.FindStringIndex(contextTextSpan)

						if valueMatch != nil {
							valueStart := contextStart + valueMatch[0]
							valueEnd := contextStart + valueMatch[1]

							eo := EntityOccurrence{
								Value:    occurrence.Value, // Store original typed value
								Position: Position{Start: valueStart, End: valueEnd},
								Context: Context{
									Text:     contextStr, // Store the context string provided by LLM
									Position: Position{Start: contextStart, End: contextEnd},
								},
							}
							finalOutput[entityName] = append(finalOutput[entityName], eo)
							foundInContext = true
						}
					}
				}
			}

			// 2. Fallback: If value wasn't found within any context match, search directly for the value
			//    (Replicates Python fallback logic)
			if !foundInContext && len(valueStr) > 1 { // Avoid searching for very short/common strings directly
				valueRegexStr := `(?i)` + regexp.QuoteMeta(valueStr) // Case-insensitive search for value
				valueRegex, err := regexp.Compile(valueRegexStr)
				if err != nil {
					s.logger.Error("Failed to compile value regex for fallback search",
						zap.String("entityName", entityName),
						zap.String("value", valueStr),
						zap.Error(err),
					)
					continue // Skip this specific occurrence if regex fails
				}

				valueMatches := valueRegex.FindAllStringIndex(normalizedText, -1)
				if len(valueMatches) > 0 {
					s.logger.Debug("Value found via fallback search", zap.String("entityName", entityName), zap.String("value", valueStr))
					for _, valueMatch := range valueMatches {
						valueStart, valueEnd := valueMatch[0], valueMatch[1]

						// Create approximate context position (like Python's +/- 20)
						// Use the LLM's context string, but position from fallback
						approxContextStart := max(0, valueStart-20)
						approxContextEnd := min(textLength, valueEnd+20)

						eo := EntityOccurrence{
							Value:    occurrence.Value,
							Position: Position{Start: valueStart, End: valueEnd},
							Context: Context{
								Text:     contextStr,                                                 // Still use context text from LLM
								Position: Position{Start: approxContextStart, End: approxContextEnd}, // Use approximate position
							},
						}
						finalOutput[entityName] = append(finalOutput[entityName], eo)
					}
				} else {
					s.logger.Warn("Could not find value or context in text",
						zap.String("entityName", entityName),
						zap.String("value", valueStr),
						zap.String("context", contextStr),
					)
				}
			} else if !foundInContext {
				s.logger.Warn("Could not find value within context and fallback skipped/failed",
					zap.String("entityName", entityName),
					zap.String("value", valueStr),
					zap.String("context", contextStr),
					zap.Int("valueLen", len(valueStr)),
				)
			}
		}
	}

	s.logger.Info("Finished position finding process")
	return finalOutput, nil
}
