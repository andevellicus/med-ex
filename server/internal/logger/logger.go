package logger

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"gopkg.in/natefinch/lumberjack.v2"
)

// NewLogger creates a new zap logger that splits logs by level and date, with rotation.
func NewLogger(logDir string, maxSizeMB int, maxBackups int, maxAgeDays int, compress bool, isProduction bool) (*zap.Logger, error) {
	// Create the log directory if it doesn't exist
	if _, err := os.Stat(logDir); os.IsNotExist(err) {
		err := os.MkdirAll(logDir, 0755)
		if err != nil {
			return nil, fmt.Errorf("failed to create log directory: %w", err)
		}
	}

	cores := []zapcore.Core{}

	levels := map[zapcore.Level]string{
		zapcore.InfoLevel:  "info",
		zapcore.WarnLevel:  "warn",
		zapcore.ErrorLevel: "error",
	}

	for level, name := range levels {
		logFile := filepath.Join(logDir, fmt.Sprintf("%s.%s.log", time.Now().Format("2006-01-02"), name))
		writeSyncer := getLogWriter(logFile, maxSizeMB, maxBackups, maxAgeDays, compress)
		encoder := getEncoder(isProduction)
		levelEnabler := zap.LevelEnablerFunc(func(lvl zapcore.Level) bool {
			return lvl == level
		})
		core := zapcore.NewCore(encoder, writeSyncer, levelEnabler)
		cores = append(cores, core)
	}

	// Add console logging for development
	if !isProduction {
		consoleEncoder := zapcore.NewConsoleEncoder(zap.NewDevelopmentEncoderConfig())
		consoleLevelEnabler := zap.LevelEnablerFunc(func(lvl zapcore.Level) bool {
			return lvl <= zapcore.ErrorLevel // Log all levels to console in dev
		})
		consoleCore := zapcore.NewCore(consoleEncoder, zapcore.Lock(os.Stdout), consoleLevelEnabler)
		cores = append(cores, consoleCore)
	}

	combinedCore := zapcore.NewTee(cores...)
	logger := zap.New(combinedCore, zap.AddCaller())
	return logger, nil
}

// LoggerMiddleware injects the logger into the context.
func LoggerMiddleware(log *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set("logger", log) // Set logger in context
		// Log request details
		start := time.Now()
		path := c.Request.URL.Path
		raw := c.Request.URL.RawQuery

		c.Next() // Process request

		// Log response details
		latency := time.Since(start)
		clientIP := c.ClientIP()
		method := c.Request.Method
		statusCode := c.Writer.Status()
		errorMessage := c.Errors.ByType(gin.ErrorTypePrivate).String()
		bodySize := c.Writer.Size()

		if raw != "" {
			path = path + "?" + raw
		}

		logFields := []zap.Field{
			zap.Int("status", statusCode),
			zap.String("method", method),
			zap.String("path", path),
			zap.String("ip", clientIP),
			zap.Duration("latency", latency),
			zap.Int("body_size", bodySize),
		}
		if errorMessage != "" {
			logFields = append(logFields, zap.String("error", errorMessage))
		}

		// Choose log level based on status code
		switch {
		case statusCode >= http.StatusInternalServerError:
			log.Error("Request Error", logFields...)
		case statusCode >= http.StatusBadRequest:
			log.Warn("Request Warning", logFields...)
		default:
			log.Info("Request Handled", logFields...)
		}
	}
}

func getEncoder(isProduction bool) zapcore.Encoder {
	encoderConfig := zap.NewProductionEncoderConfig()
	if !isProduction {
		encoderConfig = zap.NewDevelopmentEncoderConfig()
		encoderConfig.EncodeLevel = zapcore.CapitalColorLevelEncoder // Add color to level in development
	}
	encoderConfig.TimeKey = "timestamp"
	encoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder
	return zapcore.NewJSONEncoder(encoderConfig)
}

func getLogWriter(logFile string, maxSizeMB int, maxBackups int, maxAgeDays int, compress bool) zapcore.WriteSyncer {
	lumberJackLogger := &lumberjack.Logger{
		Filename:   logFile,
		MaxSize:    maxSizeMB,
		MaxBackups: maxBackups,
		MaxAge:     maxAgeDays,
		Compress:   compress,
	}
	return zapcore.AddSync(lumberJackLogger)
}
