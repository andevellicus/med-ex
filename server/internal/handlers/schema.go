package handlers

import (
	"fmt"
	"net/http"

	"github.com/andevellicus/webapp/internal/extractor" // Adjust import path
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

// GetSchemaDefinition handles GET /api/schema/:name
func (h *SchemaHandler) GetSchemaDefinition(c *gin.Context) {
	schemaName := c.Param("name") // Get schema name from URL parameter
	if schemaName == "" {
		h.Logger.Warn("Schema name parameter is missing")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing schema name parameter"})
		return
	}

	definition, exists := h.Extractor.GetSchemaDefinitionByName(schemaName)
	if !exists {
		h.Logger.Warn("Requested schema definition not found", zap.String("schema", schemaName))
		c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("Schema definition '%s' not found", schemaName)})
		return
	}

	h.Logger.Info("Responding with schema definition", zap.String("schema", schemaName))
	// Ensure the definition is not nil before sending
	if definition == nil {
		h.Logger.Error("Schema definition retrieved as nil", zap.String("schema", schemaName))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal error: Schema definition is nil"})
		return
	}
	c.JSON(http.StatusOK, definition) // Return the actual schema definition map
}
