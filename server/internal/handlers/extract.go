package handlers

import (
	"fmt"
	"net/http"

	"slices"

	"github.com/andevellicus/med-ex/internal/extractor"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// Maximum size for the uploaded file (5MB)
const maxFileSize = 5 * 1024 * 1024

// ExtractRequest defines the expected JSON body for the /api/extract endpoint.
type ExtractRequest struct {
	Text        string   `json:"text" binding:"required"`
	SchemaNames []string `json:"schema_names" binding:"required,min=1"`
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
	var req ExtractRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.Logger.Error("Failed to bind JSON request for extraction", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body: " + err.Error()})
		return
	}

	// Check if schema exists
	availableSchemas := h.Extractor.GetAvailableSchemas()
	invalidSchemas := []string{}
	for _, reqSchema := range req.SchemaNames {
		if !slices.Contains(availableSchemas, reqSchema) {
			invalidSchemas = append(invalidSchemas, reqSchema)
		}
	}
	if len(invalidSchemas) > 0 {
		h.Logger.Error("Invalid schema names requested", zap.Strings("invalid", invalidSchemas), zap.Strings("requested", req.SchemaNames))
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Invalid schema name(s) provided: %v", invalidSchemas)})
		return
	}

	// Perform extraction using multiple schema names
	result, err := h.Extractor.ProcessText(req.SchemaNames, req.Text) // Pass array
	if err != nil || result == nil {
		h.Logger.Error("Multi-schema extraction failed", zap.Error(err), zap.Strings("schemas", req.SchemaNames))
		// Provide a slightly more informative error if possible
		errMsg := "Extraction failed"
		if err != nil {
			errMsg = fmt.Sprintf("Extraction failed: %v", err)
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": errMsg})
		return
	}

	// Log success
	h.Logger.Info("Multi-schema extraction successful",
		zap.Strings("schemas", req.SchemaNames),
		zap.Int("text_length", len(req.Text)),
		zap.Int("entities_found", len(result.Entities)),
	)

	// Return result
	c.JSON(http.StatusOK, result)
}
