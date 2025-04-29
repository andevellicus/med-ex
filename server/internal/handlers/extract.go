package handlers

import (
	"fmt"
	"io"
	"net/http"
	"strings"

	"slices"

	"github.com/andevellicus/med-ex/internal/extractor"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// Maximum size for the uploaded file (5MB)
const maxFileSize = 5 * 1024 * 1024

// ExtractRequest defines the expected JSON body for the /api/extract endpoint.
type ExtractRequest struct {
	Text       string `json:"text" binding:"required"`
	SchemaName string `json:"schema_name" binding:"required"`
}

// ExtractHandler handles entity extraction requests
type ExtractHandler struct {
	Extractor *extractor.ExtractorService
	Logger    *zap.Logger
}

// NewExtractHandler creates a new extract handler
func NewExtractHandler(extractor *extractor.ExtractorService, logger *zap.Logger) *ExtractHandler {
	return &ExtractHandler{
		Extractor: extractor,
		Logger:    logger.Named("ExtractHandler"),
	}
}

// ExtractEntities handles POST /api/extract
func (h *ExtractHandler) ExtractEntities(c *gin.Context) {
	// Get selected schema from form
	schema := c.PostForm("schema")
	if schema == "" {
		h.Logger.Error("Missing schema parameter")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing schema parameter"})
		return
	}

	// Check if schema exists
	schemas := h.Extractor.GetAvailableSchemas()
	validSchema := slices.Contains(schemas, schema)
	if !validSchema {
		h.Logger.Error("Invalid schema", zap.String("schema", schema))
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid schema"})
		return
	}

	// Get file from form
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		h.Logger.Error("Error getting file", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{"error": "File upload failed"})
		return
	}
	defer file.Close()

	// Check file type
	fileName := header.Filename
	if !strings.HasSuffix(strings.ToLower(fileName), ".txt") {
		h.Logger.Error("Invalid file type", zap.String("filename", fileName))
		c.JSON(http.StatusBadRequest, gin.H{"error": "Only .txt files are supported"})
		return
	}

	// Check file size
	if header.Size > maxFileSize {
		h.Logger.Error("File too large", zap.Int64("size", header.Size))
		c.JSON(http.StatusBadRequest, gin.H{"error": "File size exceeds limit (5MB)"})
		return
	}

	// Read file content
	fileBytes, err := io.ReadAll(file)
	if err != nil {
		h.Logger.Error("Error reading file", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read file"})
		return
	}

	// Convert bytes to string
	textContent := string(fileBytes)

	// Perform extraction
	result, err := h.Extractor.ProcessText(schema, textContent)
	if err != nil || result == nil {
		h.Logger.Error("Extraction failed", zap.Error(err), zap.String("schema", schema))
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Extraction failed: %v", err)})
		return
	}

	// Log success
	h.Logger.Info("Extraction successful",
		zap.String("schema", schema),
		zap.String("filename", header.Filename),
		zap.Int64("filesize", header.Size))

	// Return result
	c.JSON(http.StatusOK, result)
}
