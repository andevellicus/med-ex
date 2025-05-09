package extractor

import (
	"fmt"
	"net/http"
	"net/url"
	"path/filepath"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/andevellicus/med-ex/internal/config"
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
	// Using 'any' (any) provides flexibility.
	Value    any      `json:"value"`
	Position Position `json:"position"` // Position of the Value in the original text
	Context  Context  `json:"context"`  // Surrounding context and its position
	ID       string   `json:"id"`       // Unique identifier for the occurrence
}

// ExtractionOutput maps an entity name (e.g., "Age", "Vital signs.Temperature")
// to a slice of all occurrences found for that entity.
type ExtractionOutput struct {
	Text     string                        `json:"text"` // The original text used for extraction
	Entities map[string][]EntityOccurrence `json:"entities"`
}

// ExtractorService holds dependencies
type ExtractorService struct {
	llmServerURL string
	httpClient   *http.Client
	logger       *zap.Logger
	Schemas      map[string]Schema
	schemaNames  []string
	SchemaFiles  map[string]string
}

func NewExtractorService(cfg *config.Config, logger *zap.Logger, projectRoot string) (*ExtractorService, error) {
	llmURL := cfg.LLM.ServerURL
	// Ensure schema dir path is absolute
	schemasDir := cfg.LLM.SchemaDir
	if !filepath.IsAbs(schemasDir) {
		schemasDir = filepath.Join(projectRoot, schemasDir)
	}
	logger.Info("Resolved schema directory", zap.String("path", schemasDir))

	_, err := url.ParseRequestURI(llmURL)
	if err != nil {
		logger.Error("Invalid LLM Server URL configured", zap.String("url", llmURL), zap.Error(err))
		return nil, fmt.Errorf("invalid llm server url: %w", err)
	}

	// Load Schemas AND their file paths
	schemas, schemaNames, schemaFiles, err := loadSchemasFromDir(schemasDir, logger) // Modified return
	if err != nil {
		logger.Error("Failed to load schemas", zap.String("directory", schemasDir), zap.Error(err))
		return nil, fmt.Errorf("failed to load schemas from %s: %w", schemasDir, err)
	}
	if len(schemas) == 0 {
		// This might be acceptable, but log a warning
		logger.Warn("No schemas found or loaded from directory", zap.String("directory", schemasDir))
		// return nil, fmt.Errorf("no schemas found in directory: %s", schemasDir) // Changed to Warning
	} else {
		logger.Info("Successfully loaded schemas", zap.Strings("names", schemaNames))
	}

	return &ExtractorService{
		llmServerURL: llmURL,
		httpClient: &http.Client{
			Timeout: 5 * time.Minute, // Keep existing timeout
		},
		logger:      logger.Named("extractor"),
		Schemas:     schemas,
		schemaNames: schemaNames,
		SchemaFiles: schemaFiles, // Store file paths
	}, nil
}

// ExtractEntities processes text content using the specified schema
func (s *ExtractorService) ExtractEntities(schemaName string, content string) (map[string]any, error) {
	// Check if schema exists
	_, exists := s.Schemas[schemaName]
	if !exists {
		return nil, fmt.Errorf("schema '%s' not found", schemaName)
	}

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
func (s *ExtractorService) ProcessText(schemaNames []string, text string) (*ExtractionOutput, error) {
	s.logger.Info("Starting extraction process",
		zap.Strings("schemaName", schemaNames),
		zap.Int("textLength", len(text)),
	)

	// Step 0: Normalize text
	// Replace Windows CRLF and standalone CR with Unix LF for consistency
	normalizedText := strings.ReplaceAll(text, "\r\n", "\n")
	normalizedText = strings.ReplaceAll(normalizedText, "\r", "\n")
	s.logger.Debug("Text normalizedoy", zap.Int("normalizedLength", len(normalizedText)))

	combinedSchema, err := s.CombineSchemas(schemaNames)
	if err != nil {
		s.logger.Error("Failed to combine schemas", zap.Strings("names", schemaNames), zap.Error(err))
		return nil, fmt.Errorf("failed during schema combination: %w", err)
	}

	// Step 1: Format the prompt
	prompt, err := s.formatExtractionPrompt(combinedSchema, normalizedText)
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
	if err != nil || finalOutput == nil {
		// Error potentially logged in findEntityPositions, but add context here
		s.logger.Error("Failed during entity position finding", zap.Error(err))
		return nil, fmt.Errorf("failed during position finding: %w", err)
	}

	s.logger.Info("Extraction process completed successfully",
		zap.Strings("schemaName", schemaNames),
		zap.Int("finalEntityCount", len(finalOutput.Entities)), // Count top-level entities
	)
	return finalOutput, nil
}

// findEntityPositions locates the extracted values and contexts in the text.
func (s *ExtractorService) findEntityPositions(normalizedText string, rawExtraction RawLLMExtraction) (*ExtractionOutput, error) {
	finalOutput := make(map[string][]EntityOccurrence)
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

		for occIndex, occurrence := range occurrences {
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
			id := fmt.Sprintf("entity-%s-%d", entityName, occIndex)

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
						contextByteStart, contextByteEnd := contextMatch[0], contextMatch[1] // BYTE indices of context
						contextTextSpan := normalizedText[contextByteStart:contextByteEnd]

						// Find the first match of the value *within this specific context span*
						valueMatchRelIndices := valueRegex.FindStringIndex(contextTextSpan) // Relative BYTE indices within context span

						if valueMatchRelIndices != nil {
							// Calculate absolute BYTE indices in normalizedText for the full value match
							valueByteStart := contextByteStart + valueMatchRelIndices[0]
							valueByteEnd := contextByteStart + valueMatchRelIndices[1] // End index for the full value (e.g., "98.7°F")

							// --- Convert BYTE indices to RUNE indices ---
							runeHighlightStart := byteIndexToRuneIndex(normalizedText, valueByteStart)
							runeHighlightEnd := byteIndexToRuneIndex(normalizedText, valueByteEnd)
							runeContextStart := byteIndexToRuneIndex(normalizedText, contextByteStart)
							runeContextEnd := byteIndexToRuneIndex(normalizedText, contextByteEnd)
							eo := EntityOccurrence{
								Value:    occurrence.Value, // Store original typed value
								Position: Position{Start: runeHighlightStart, End: runeHighlightEnd},
								Context: Context{
									Text:     contextStr, // Store the context string provided by LLM
									Position: Position{Start: runeContextStart, End: runeContextEnd},
								},
								ID: id,
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
						valueByteStart, valueByteEnd := valueMatch[0], valueMatch[1] // BYTE indices

						approxContextByteStart := max(0, valueByteStart-20)
						approxContextByteEnd := min(textLength, valueByteEnd+20)

						// --- Convert Fallback BYTE indices to RUNE indices ---
						runeHighlightStart := byteIndexToRuneIndex(normalizedText, valueByteStart)
						runeHighlightEnd := byteIndexToRuneIndex(normalizedText, valueByteEnd)
						runeApproxContextStart := byteIndexToRuneIndex(normalizedText, approxContextByteStart)
						runeApproxContextEnd := byteIndexToRuneIndex(normalizedText, approxContextByteEnd)

						eo := EntityOccurrence{
							Value:    occurrence.Value,
							Position: Position{Start: runeHighlightStart, End: runeHighlightEnd},
							Context: Context{
								Text:     contextStr,                                                         // Still use context text from LLM
								Position: Position{Start: runeApproxContextStart, End: runeApproxContextEnd}, // Use approximate position
							},
							ID: id,
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
	return &ExtractionOutput{
		Text:     normalizedText,
		Entities: finalOutput,
	}, nil
}

// byteIndexToRuneIndex converts a byte index within a UTF-8 string to a rune index (character count).
// It handles potential out-of-bounds indices gracefully.
func byteIndexToRuneIndex(text string, byteIdx int) int {
	if byteIdx <= 0 {
		return 0 // Rune index at the start is always 0
	}
	// Clamp byteIdx to be within the valid range of the string length
	if byteIdx > len(text) {
		byteIdx = len(text)
	}
	// Count the number of runes (characters) in the substring up to the byte index
	return utf8.RuneCountInString(text[:byteIdx])
}
