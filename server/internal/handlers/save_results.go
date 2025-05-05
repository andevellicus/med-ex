package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"strings"

	"github.com/andevellicus/med-ex/internal/extractor" // Assuming types are here
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"gopkg.in/yaml.v3"
)

// SaveResultsRequest defines the JSON structure expected from the frontend.
type SaveResultsRequest struct {
	SchemaNames      []string                                `json:"schemaNames" binding:"required,min=1"`
	Text             string                                  `json:"text" binding:"required"`
	Entities         map[string][]extractor.EntityOccurrence `json:"entities"`
	OriginalFilename string                                  `json:"originalFilename" binding:"required"`
}

// SaveResultsResponse defines the JSON structure for the results file.
type SaveResultsResponse struct {
	Text     string                                  `json:"text"`
	Entities map[string][]extractor.EntityOccurrence `json:"entities"`
}

// SaveResultsHandler handles saving results requests.
type SaveResultsHandler struct {
	ResultsBaseDir string
	Extractor      *extractor.ExtractorService
	Logger         *zap.Logger
}

// NewSaveResultsHandler creates a new save handler.
func NewSaveResultsHandler(resultsBaseDir string, extractor *extractor.ExtractorService, logger *zap.Logger) *SaveResultsHandler {
	return &SaveResultsHandler{
		ResultsBaseDir: resultsBaseDir,
		Extractor:      extractor,
		Logger:         logger.Named("SaveResultsHandler"),
	}
}

// SaveResults handles POST /api/save-results
func (h *SaveResultsHandler) SaveResults(c *gin.Context) {
	var req SaveResultsRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		h.Logger.Error("Failed to bind request JSON", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body: " + err.Error()})
		return
	}

	// --- Input Validation ---
	if req.Text == "" || req.OriginalFilename == "" {
		h.Logger.Warn("Save request missing text or original filename")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Text content and original filename are required"})
		return
	}
	// Validate schema names exist
	availableSchemas := h.Extractor.GetAvailableSchemas()
	invalidSchemas := []string{}
	validSchemaNames := []string{} // Collect valid names
	for _, reqSchema := range req.SchemaNames {
		cleanSchemaName := filepath.Base(reqSchema) // Basic sanitization
		if cleanSchemaName != reqSchema || strings.Contains(cleanSchemaName, "..") {
			invalidSchemas = append(invalidSchemas, fmt.Sprintf("%s (invalid format)", reqSchema))
			continue // Skip invalid format
		}
		if !slices.Contains(availableSchemas, cleanSchemaName) {
			invalidSchemas = append(invalidSchemas, fmt.Sprintf("%s (not found)", reqSchema))
		} else {
			validSchemaNames = append(validSchemaNames, cleanSchemaName) // Add valid, clean name
		}
	}
	if len(invalidSchemas) > 0 {
		h.Logger.Error("Invalid or missing schema names requested for save", zap.Strings("invalid_or_missing", invalidSchemas), zap.Strings("requested", req.SchemaNames))
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Invalid or missing schema name(s): %v", invalidSchemas)})
		return
	}
	if len(validSchemaNames) == 0 { // Should be caught by binding:"min=1" but double-check
		h.Logger.Error("No valid schema names provided after filtering", zap.Strings("requested", req.SchemaNames))
		c.JSON(http.StatusBadRequest, gin.H{"error": "No valid schema names provided"})
		return
	}

	if req.Entities == nil {
		req.Entities = make(map[string][]extractor.EntityOccurrence)
	}
	// --- End Validation ---

	// Sanitize original filename for folder name
	folderName := sanitizeFilenameForFolder(req.OriginalFilename)
	targetDir := filepath.Join(h.ResultsBaseDir, folderName)

	// Create the directory
	if err := os.MkdirAll(targetDir, 0755); err != nil {
		h.Logger.Error("Failed to create results directory", zap.String("path", targetDir), zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create save directory"})
		return
	}

	// --- Save COMBINED schema.yaml ---
	h.Logger.Info("Attempting to combine schemas for saving", zap.Strings("schemas", validSchemaNames))
	combinedSchemaData, err := h.Extractor.CombineSchemas(validSchemaNames) // Use valid names
	if err != nil {
		h.Logger.Error("Failed to combine schemas for saving", zap.Strings("schemas", validSchemaNames), zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to combine schemas: " + err.Error()})
		return
	}

	// Marshal the combined schema data to YAML
	combinedYamlBytes, err := yaml.Marshal(combinedSchemaData)
	if err != nil {
		h.Logger.Error("Failed to marshal combined schema to YAML", zap.Strings("schemas", validSchemaNames), zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate combined schema file content"})
		return
	}

	// Write the combined YAML to schema.yaml
	schemaTargetPath := filepath.Join(targetDir, "schema.yaml")
	if err := os.WriteFile(schemaTargetPath, combinedYamlBytes, 0644); err != nil {
		h.Logger.Error("Failed to write combined schema file", zap.String("path", schemaTargetPath), zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save combined schema file"})
		return
	}
	h.Logger.Info("Saved combined schema file", zap.String("path", schemaTargetPath), zap.Strings("source_schemas", validSchemaNames))
	// --- End Save Combined Schema ---

	// --- Save text.txt (logic remains the same) ---
	textTargetPath := filepath.Join(targetDir, "text.txt")
	if err := os.WriteFile(textTargetPath, []byte(req.Text), 0644); err != nil {
		h.Logger.Error("Failed to write text file", zap.String("path", textTargetPath), zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save text file"})
		return
	}
	h.Logger.Info("Saved text file", zap.String("path", textTargetPath))

	// --- Save results.json (logic remains the same) ---
	resultsData := SaveResultsResponse{
		Text:     req.Text,
		Entities: req.Entities,
	}
	resultsJSON, err := json.MarshalIndent(resultsData, "", "  ")
	if err != nil {
		h.Logger.Error("Failed to marshal results data to JSON", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to prepare results data"})
		return
	}
	resultsTargetPath := filepath.Join(targetDir, "results.json")
	if err := os.WriteFile(resultsTargetPath, resultsJSON, 0644); err != nil {
		h.Logger.Error("Failed to write results JSON file", zap.String("path", resultsTargetPath), zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save results JSON file"})
		return
	}
	h.Logger.Info("Saved results JSON file", zap.String("path", resultsTargetPath))

	// --- Success Response ---
	h.Logger.Info("Successfully saved results with combined schema",
		zap.Strings("schemas", validSchemaNames),
		zap.String("original_filename", req.OriginalFilename),
		zap.String("folder_name", folderName),
	)
	c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("Results saved successfully to folder '%s' using combined schema.", folderName)})
}

// --- Function to sanitize filename for folder name ---
func sanitizeFilenameForFolder(filename string) string {
	// 1. Remove extension
	nameWithoutExt := strings.TrimSuffix(filename, filepath.Ext(filename))
	// 2. Replace spaces with underscores
	nameWithUnderscores := strings.ReplaceAll(nameWithoutExt, " ", "_")
	// 3. Basic sanitization: Keep alphanumeric, underscore, hyphen. Remove others.
	//    (More robust sanitization might be needed for production)
	sanitized := ""
	for _, r := range nameWithUnderscores {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '_' || r == '-' {
			sanitized += string(r)
		}
	}
	// Prevent empty folder names
	if sanitized == "" {
		sanitized = "untitled_result"
	}
	return sanitized
}
