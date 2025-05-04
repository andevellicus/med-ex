package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/andevellicus/med-ex/internal/extractor" // Assuming types are here
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// SaveResultsRequest defines the JSON structure expected from the frontend.
type SaveResultsRequest struct {
	SchemaName string                                  `json:"schemaName" binding:"required"`
	Text       string                                  `json:"text" binding:"required"`
	Entities   map[string][]extractor.EntityOccurrence `json:"entities"` // Use the existing type
	FileName   string                                  `json:"fileName" binding:"required"`
}

// SaveResultsResponse defines the JSON structure for the results file.
type SaveResultsResponse struct {
	Text     string                                  `json:"text"`
	Entities map[string][]extractor.EntityOccurrence `json:"entities"`
}

// SaveResultsHandler handles saving results requests.
type SaveResultsHandler struct {
	ResultsBaseDir string
	SchemaBaseDir  string // Need this to find the original schema file
	Logger         *zap.Logger
}

// NewSaveResultsHandler creates a new save handler.
func NewSaveResultsHandler(resultsBaseDir string, schemaBaseDir string, logger *zap.Logger) *SaveResultsHandler {
	return &SaveResultsHandler{
		ResultsBaseDir: resultsBaseDir,
		SchemaBaseDir:  schemaBaseDir,
		Logger:         logger.Named("SaveResultsHandler"),
	}
}

// SaveResults handles POST /api/save-results
func (h *SaveResultsHandler) SaveResults(c *gin.Context) {
	var req SaveResultsRequest

	// Bind JSON request body
	if err := c.ShouldBindJSON(&req); err != nil {
		h.Logger.Error("Failed to bind request JSON", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body: " + err.Error()})
		return
	}

	// --- Input Validation & Sanitization ---
	if req.Text == "" {
		h.Logger.Warn("Save request received with empty text")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Text content cannot be empty"})
		return
	}
	if req.FileName == "" { // Added check
		h.Logger.Warn("Save request received without original filename")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Original filename is missing"})
		return
	}

	// Basic sanitization for schema name (prevent path traversal)
	cleanSchemaName := filepath.Base(req.SchemaName)
	if cleanSchemaName != req.SchemaName || strings.Contains(cleanSchemaName, "..") {
		h.Logger.Error("Invalid schema name potentially attempting traversal", zap.String("original", req.SchemaName), zap.String("cleaned", cleanSchemaName))
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid schema name format"})
		return
	}
	// Ensure Entities map is not nil if provided (it might be empty, which is ok)
	if req.Entities == nil {
		req.Entities = make(map[string][]extractor.EntityOccurrence) // Initialize if nil
	}
	// --- End Validation ---

	folderName := sanitizeFilenameForFolder(req.FileName)

	// Create target directory path
	targetDir := filepath.Join(h.ResultsBaseDir, folderName)

	// Create the directory if it doesn't exist
	if err := os.MkdirAll(targetDir, 0755); err != nil {
		h.Logger.Error("Failed to create results directory", zap.String("path", targetDir), zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create save directory"})
		return
	}

	// --- Save schema.yaml ---
	originalSchemaFileName := cleanSchemaName + ".yaml" // Assuming .yaml extension
	originalSchemaPath := filepath.Join(h.SchemaBaseDir, originalSchemaFileName)
	schemaContent, err := os.ReadFile(originalSchemaPath)
	if err != nil {
		h.Logger.Error("Failed to read original schema file",
			zap.String("schema_name", cleanSchemaName),
			zap.String("path", originalSchemaPath),
			zap.Error(err))
		// Decide if this is a fatal error for the save operation
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Could not read schema file '%s'", cleanSchemaName)})
		return
	}
	schemaTargetPath := filepath.Join(targetDir, "schema.yaml")
	if err := os.WriteFile(schemaTargetPath, schemaContent, 0644); err != nil {
		h.Logger.Error("Failed to write schema file", zap.String("path", schemaTargetPath), zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save schema file"})
		return
	}
	h.Logger.Info("Saved schema file", zap.String("path", schemaTargetPath))

	// --- Save text.txt ---
	textTargetPath := filepath.Join(targetDir, "text.txt")
	if err := os.WriteFile(textTargetPath, []byte(req.Text), 0644); err != nil {
		h.Logger.Error("Failed to write text file", zap.String("path", textTargetPath), zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save text file"})
		return
	}
	h.Logger.Info("Saved text file", zap.String("path", textTargetPath))

	// --- Save results.json ---
	resultsData := SaveResultsResponse{
		Text:     req.Text,
		Entities: req.Entities,
	}
	resultsJSON, err := json.MarshalIndent(resultsData, "", "  ") // Pretty print
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
	h.Logger.Info("Successfully saved results",
		zap.String("schema", cleanSchemaName),
		zap.String("filename", req.FileName),
		zap.String("folder_name", folderName)) // Log the derived folder name
	c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("Results saved successfully to folder '%s'", folderName)})

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
