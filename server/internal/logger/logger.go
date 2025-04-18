package logger

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

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
