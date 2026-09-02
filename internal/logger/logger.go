package logger

import "go.uber.org/zap"

var Log *zap.Logger

func Init() {
	var err error
	// NewProduction builds a sensible production logger that writes InfoLevel and above
	// logs to standard error as JSON.
	Log, err = zap.NewProduction()
	if err != nil {
		panic("Failed to initialize Zap logger: " + err.Error())
	}
}

// Sync flushes any buffered log entries. Call this when your app exits.
func Sync() {
	_ = Log.Sync()
}
