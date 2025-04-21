package extractor

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"go.uber.org/zap"
)

type LLMResponse struct {
	Content            string          `json:"content"`
	Stop               bool            `json:"stop"`
	Model              string          `json:"model"`
	TokensPredicted    int             `json:"tokens_predicted"`
	TokensEvaluated    int             `json:"tokens_evaluated"`
	GenerationSettings json.RawMessage `json:"generation_settings"`
	Timings            json.RawMessage `json:"timings"`
}

// LLMOutputValueContext is the intermediate structure we expect the LLM
// to generate *within* the JSON object for each entity occurrence.
// It only contains the value and the context string. Positions are calculated later.
type LLMOutputValueContext struct {
	Value   any    `json:"value"`   // Use 'any' for flexibility (string, number, bool, list, etc.)
	Context string `json:"context"` // Just the context string from the LLM
}

// RawLLMExtraction defines the expected structure of the *entire* JSON object
// returned directly by the LLM's text completion (after potentially being wrapped
// in LLMResponse). Keys are entity names (potentially dotted).
type RawLLMExtraction map[string][]LLMOutputValueContext

func (s *ExtractorService) callLLM(prompt string) (string, error) {
	payload := map[string]any{ // Using a map for flexibility, matches Python example better
		"prompt":       prompt,
		"max_tokens":   16384, // Or use n_predict as per llama.cpp docs
		"temperature":  0.01,
		"top_p":        0.5,
		"stop":         []string{"<|im_end|>"}, // Common stop sequence
		"n_predict":    -1,                     // Predict until stop or context full
		"stream":       false,                  // Ensure streaming is off
		"cache_prompt": true,                   // Optional: might speed up similar requests
	}

	data, err := json.Marshal(payload)
	if err != nil {
		s.logger.Error("Failed to marshal request payload", zap.Error(err))
		return "", fmt.Errorf("failed to marshal request payload: %w", err)
	}
	s.logger.Debug("Attempting LLM call", zap.String("url", s.llmServerURL))
	req, err := http.NewRequest("POST", s.llmServerURL, bytes.NewBuffer(data))
	if err != nil {
		s.logger.Error("Failed to create request", zap.Error(err))
		return "", fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		s.logger.Error("Failed to send request to LLM server", zap.Error(err))
		return "", fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body) // Read the entire body
	if err != nil {
		s.logger.Error("Failed to read LLM response body", zap.Error(err))
		return "", fmt.Errorf("failed to read LLM response body: %w", err)
	}
	// IMPORTANT: Log the raw body content
	s.logger.Debug("Received raw LLM response body", zap.String("body", string(bodyBytes)))
	if resp.StatusCode != http.StatusOK {
		s.logger.Error("LLM server returned non-ok status",
			zap.Int("status_code", resp.StatusCode),
			zap.String("error_body", string(bodyBytes)), // Log full body on error
		)
		return "", fmt.Errorf("llm server returned non-200 status: %d - %s", resp.StatusCode, limitString(string(bodyBytes), 100))
	}

	// Decode the outer JSON structure
	var outerResponse LLMResponse
	if err := json.Unmarshal(bodyBytes, &outerResponse); err != nil {
		s.logger.Error("Failed to decode outer LLM response JSON", zap.Error(err), zap.String("raw_body_snippet", limitString(string(bodyBytes), 200)))
		return "", fmt.Errorf("failed to decode outer LLM response JSON: %w", err)
	}

	// Extract the inner JSON string from the 'content' field
	innerJsonString := outerResponse.Content

	// --- Optional: Clean the inner JSON string ---
	// The LLM sometimes includes markdown fences (```json ... ```) or leading/trailing whitespace
	innerJsonString = strings.TrimSpace(innerJsonString)
	if strings.HasPrefix(innerJsonString, "```json") {
		innerJsonString = strings.TrimPrefix(innerJsonString, "```json")
	}
	if strings.HasPrefix(innerJsonString, "```") { // Handle case where only ``` is present
		innerJsonString = strings.TrimPrefix(innerJsonString, "```")
	}
	if strings.HasSuffix(innerJsonString, "```") {
		innerJsonString = strings.TrimSuffix(innerJsonString, "```")
	}
	innerJsonString = strings.TrimSpace(innerJsonString) // Trim again after removing fences
	// --- End Optional Cleaning ---

	// Check if the extracted content is empty after cleaning
	if innerJsonString == "" {
		s.logger.Error("Extracted 'content' field is empty after cleaning", zap.String("raw_body_snippet", limitString(string(bodyBytes), 200)))
		return "", fmt.Errorf("extracted 'content' from LLM response is empty")
	}

	s.logger.Debug("Extracted inner JSON string (after cleaning)", zap.String("inner_json", innerJsonString))

	// Return the inner JSON string, which will be parsed later
	return innerJsonString, nil
}

// formatExtractionPrompt formats the prompt for the LLM based on the Python script's template.
func (s *ExtractorService) formatExtractionPrompt(schemaName string, text string) (string, error) {
	// Retrieve the specific schema from the loaded map
	schema, ok := s.schemas[schemaName]
	if !ok {
		s.logger.Error("Schema not found", zap.String("schemaName", schemaName))
		return "", fmt.Errorf("schema '%s' not found", schemaName)
	}

	// Marshal the schema map into a pretty-printed JSON string
	schemaJSON, err := json.MarshalIndent(schema, "", "  ") // Indent with 2 spaces
	if err != nil {
		s.logger.Error("Failed to marshal schema to JSON", zap.String("schemaName", schemaName), zap.Error(err))
		return "", fmt.Errorf("failed to marshal schema '%s' to JSON: %w", schemaName, err)
	}

	s.logger.Info("Formatting prompt for schema", zap.String("schemaName", schemaName))

	// Use fmt.Sprintf to build the prompt string, replicating the Python structure
	// Note: Backticks ` ` are used for raw string literals in Go to handle newlines and quotes easily.
	prompt := fmt.Sprintf(
		`<|im_start|>system
You are a medical information extraction system specialized in extracting entities with their surrounding context. Your output MUST be a valid JSON object.
<|im_end|>
<|im_start|>user
Extract the following entities from the medical text according to this schema:

%s%s%s

Medical Text:
%s
%s
%s

Extract all entities listed in the schema that are present in the text. For each entity found, provide:
1. The exact 'value' of the entity as it appears in the text.
2. The 'context' (the surrounding phrase or sentence) where the value was found.

Special instructions:
- Provide the exact surrounding context text for the 'context' field -- IMPORTANT: provide ONLY 3-5 tokens before or after the value, enough so that it can be found with pattern matching.
- For numeric values (like scores, grades, dates, etc.), include identifying phrases or labels in the context, especially for single character values. Ensure no duplicates in the context.
- For vital signs, extract both the value and the unit if present in the 'value' field.
- If an entity is not present in the text, omit it from the final JSON or set its value to null or an empty list as appropriate according to the schema type.
- Structure nested entities (like Vital Signs properties) using dot notation in the JSON keys (e.g., "Vital signs.Temperature").
- Always return the found occurrences for an entity within a JSON list (array), even if only one occurrence is found.

Return ONLY a single valid JSON object containing the extracted entities and their contexts. The JSON object should follow this structure:

%s
{
  "entity_name_with_multiple_values": [
    {
      "value": "first extracted value",
      "context": "Context for the first value."
    },
    {
      "value": "second extracted value",
      "context": "Context for the second value."
    }
  ],
  "entity_name_with_single_value": [ // Still use a list even for one item
    {
      "value": "the single value found",
      "context": "Context for the single value."
    }
  ],
  "nested_entity.nested_property": [ // Example using dot notation, also in a list
    {
      "value": "property value",
      "context": "surrounding context text for property"
    }
  ]
  // ... other entities, always as key: [ {value:..., context:...}, ... ]
}
%s

Use standard JSON format: double quotes for all keys and string values, 'true'/'false' for booleans, 'null' for null values. Do NOT include %s%s markers or any other text outside the main JSON object in your response.
<|im_end|>
<|im_start|>assistant
`,
		"```json",          // Start code block for schema JSON
		string(schemaJSON), // The schema itself as JSON
		"```",              // End code block for schema JSON
		"```",              // Start code block for medical text
		text,               // The input medical text
		"```",              // End code block for medical text
		"```json",          // Start code block for example output format
		"```",              // End code block for example output format
		"```json",          // Stray markers mentioned in prompt instruction
		"```",              // Stray markers mentioned in prompt instruction
	)

	return prompt, nil
}

// parseLLMResponse parses the JSON string returned by the LLM.
func (s *ExtractorService) parseLLMResponse(llmResponseString string) (RawLLMExtraction, error) {
	// Check if the cleaned response looks like a JSON object
	if !strings.HasPrefix(llmResponseString, "{") || !strings.HasSuffix(llmResponseString, "}") {
		s.logger.Error("LLM response does not appear to be a valid JSON object",
			zap.String("inner_json_snippet", limitString(llmResponseString, 100)), // Log a snippet
		)
		// Optionally log the full llmResponseString if needed for debugging, but be mindful of size
		// zap.String("full_cleaned_response", llmResponseString)
		return nil, fmt.Errorf("LLM response is not a JSON object: %s...", limitString(llmResponseString, 50))
	}

	var parsedData RawLLMExtraction
	err := json.Unmarshal([]byte(llmResponseString), &parsedData)
	if err != nil {
		s.logger.Error("Failed to unmarshal LLM response JSON into RawLLMExtraction",
			zap.Error(err),
			zap.String("response_snippet", limitString(llmResponseString, 100)), // Log snippet on error
		)
		// zap.String("full_response", llmResponseString) // Optional: log full string on error
		return nil, fmt.Errorf("failed to unmarshal LLM JSON: %w", err)
	}

	s.logger.Info("Successfully parsed LLM response JSON", zap.Int("entity_count", len(parsedData)))
	return parsedData, nil
}

// Helper function to limit string length for logging
func limitString(s string, maxLength int) string {
	if len(s) <= maxLength {
		return s
	}
	return s[:maxLength] + "..." // Indicate truncation
}
