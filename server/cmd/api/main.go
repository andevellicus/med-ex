package main

import (
	"flag"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"runtime"

	"github.com/andevellicus/med-ex/internal/config"
	"github.com/andevellicus/med-ex/internal/extractor"
	"github.com/andevellicus/med-ex/internal/handlers"
	"github.com/andevellicus/med-ex/internal/logger"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func main() {
	// Parse command line flags
	configPath := flag.String("config", "", "Path to configuration file")
	flag.Parse()

	rootPath, err := findRoot()
	if err != nil {
		panic("Could not determine project root: " + err.Error())
	}

	// Load configuration using the path from the flag
	cfg, err := config.LoadConfig(*configPath)
	if err != nil {
		panic("failed to load configuration: " + err.Error())
	}

	// Initialize the logger using configuration values
	log, err := logger.NewLogger(
		filepath.Join(rootPath, cfg.Log.LogDir),
		cfg.Log.MaxSizeMB,
		cfg.Log.MaxBackups,
		cfg.Log.MaxAgeDays,
		cfg.Log.Compress,
		os.Getenv("GO_ENV") == "production",
	)
	if err != nil {
		panic("failed to initialize logger: " + err.Error())
	}
	defer log.Sync()

	// --- Add Service Initialization ---
	extractorService, err := extractor.NewExtractorService(cfg, log, rootPath)
	if err != nil {
		log.Fatal("Failed to initialize extractor service", zap.Error(err))
	}
	log.Info("Extractor service initialized")
	// --- Add Handler Initialization ---
	schemaHandler := handlers.NewSchemaHandler(extractorService, log)
	extractHandler := handlers.NewExtractHandler(extractorService, log)
	log.Info("Handlers initialized")

	// Set Gin mode
	if os.Getenv("GO_ENV") == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(func(c *gin.Context) {
		c.Set("logger", log)
		c.Next()
	})

	// --- Add API Route ---
	api := router.Group("/api") // Group API routes
	{

		api.GET("/schemas", schemaHandler.GetSchemas)
		api.GET("/schemas/:schemaName/details", schemaHandler.GetSchemaDetails)
		api.POST("/extract", extractHandler.ExtractEntities)
		// Add other API routes here
	}

	clientDistPath := filepath.Join(rootPath, "client", "dist")
	router.Use(staticFS(clientDistPath))

	router.Run(":" + cfg.Server.Port) // Use the port from the config
}

func staticFS(root string) gin.HandlerFunc {
	fileServer := http.FileServer(http.Dir(root))
	return func(c *gin.Context) {
		fileServer.ServeHTTP(c.Writer, c.Request)
		c.Abort()
	}
}

func findRoot() (string, error) {
	_, currentFile, _, ok := runtime.Caller(0)
	if !ok {
		return "", fmt.Errorf("could not get current file information")
	}
	dir := filepath.Dir(currentFile) // Start at the directory containing main.go

	for {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return filepath.Dir(dir), nil // Found go.mod, this is the root
		}

		parentDir := filepath.Dir(dir)
		if parentDir == dir {
			return "", fmt.Errorf("could not find go.mod in any parent directory")
		}
		dir = parentDir
	}
}
