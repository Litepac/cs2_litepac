package server

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

const (
	maxTelemetryLogBytes   int64 = 16 << 20
	maxTelemetryEntryBytes       = 64 << 10
	maxLogMetadataRunes          = 512
)

var telemetryLogMu sync.Mutex

func decodeSingleJSON(reader io.Reader, target any) error {
	decoder := json.NewDecoder(reader)
	if err := decoder.Decode(target); err != nil {
		return err
	}

	var trailing any
	if err := decoder.Decode(&trailing); err != io.EOF {
		if err == nil {
			return fmt.Errorf("request body must contain one JSON object")
		}
		return fmt.Errorf("read trailing request data: %w", err)
	}

	return nil
}

func boundedLogValue(value string) string {
	value = strings.TrimSpace(value)
	runes := []rune(value)
	if len(runes) <= maxLogMetadataRunes {
		return value
	}
	return string(runes[:maxLogMetadataRunes])
}

func appendTelemetryLogs(ndjsonPath string, ndjsonLine string, readableLine string) error {
	if len(ndjsonLine) > maxTelemetryEntryBytes || len(readableLine) > maxTelemetryEntryBytes {
		return fmt.Errorf("telemetry log entry exceeds %d bytes", maxTelemetryEntryBytes)
	}

	readablePath := strings.TrimSuffix(ndjsonPath, ".ndjson") + ".log"

	telemetryLogMu.Lock()
	defer telemetryLogMu.Unlock()

	if err := os.MkdirAll(filepath.Dir(ndjsonPath), 0o755); err != nil {
		return fmt.Errorf("create telemetry log directory: %w", err)
	}

	if err := ensureLogCapacity(ndjsonPath, int64(len(ndjsonLine))); err != nil {
		return err
	}
	if err := ensureLogCapacity(readablePath, int64(len(readableLine))); err != nil {
		return err
	}

	if err := appendLogLine(ndjsonPath, ndjsonLine); err != nil {
		return err
	}
	if err := appendLogLine(readablePath, readableLine); err != nil {
		return err
	}

	return nil
}

func ensureLogCapacity(path string, additionalBytes int64) error {
	info, err := os.Stat(path)
	if err != nil {
		if os.IsNotExist(err) {
			if additionalBytes > maxTelemetryLogBytes {
				return fmt.Errorf("telemetry log entry exceeds log capacity")
			}
			return nil
		}
		return fmt.Errorf("inspect telemetry log: %w", err)
	}

	if info.Size()+additionalBytes > maxTelemetryLogBytes {
		return fmt.Errorf("telemetry log %s reached the %d-byte limit", filepath.Base(path), maxTelemetryLogBytes)
	}
	return nil
}

func appendLogLine(path string, line string) error {
	file, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return fmt.Errorf("open telemetry log: %w", err)
	}
	defer file.Close()

	if _, err := file.WriteString(line); err != nil {
		return fmt.Errorf("write telemetry log: %w", err)
	}
	return nil
}
