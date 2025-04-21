package handlers

import (
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

// May be able to remove this later -- we don't need to get schemas // TODO
