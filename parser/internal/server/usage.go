package server

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const maxUsageEventBytes = 32 << 10

type usageEventRequest struct {
	Event   string         `json:"event"`
	Details map[string]any `json:"details"`
}

type usageEventLogEntry struct {
	Event     string         `json:"event"`
	Details   map[string]any `json:"details,omitempty"`
	Host      string         `json:"host,omitempty"`
	Method    string         `json:"method"`
	Origin    string         `json:"origin,omitempty"`
	Path      string         `json:"path"`
	Remote    string         `json:"remote,omitempty"`
	Timestamp string         `json:"timestamp"`
	UserAgent string         `json:"userAgent,omitempty"`
}

func appendUsageEvent(r *http.Request) error {
	defer r.Body.Close()

	var eventRequest usageEventRequest
	if err := json.NewDecoder(io.LimitReader(r.Body, maxUsageEventBytes)).Decode(&eventRequest); err != nil {
		return fmt.Errorf("decode usage event: %w", err)
	}

	eventName := strings.TrimSpace(eventRequest.Event)
	if eventName == "" {
		eventName = "unknown"
	}

	entry := usageEventLogEntry{
		Event:     eventName,
		Details:   eventRequest.Details,
		Host:      r.Host,
		Method:    r.Method,
		Origin:    r.Header.Get("Origin"),
		Path:      r.URL.Path,
		Remote:    r.RemoteAddr,
		Timestamp: time.Now().UTC().Format(time.RFC3339Nano),
		UserAgent: r.UserAgent(),
	}

	return writeUsageEventLog(entry)
}

func writeUsageEventLog(entry usageEventLogEntry) error {
	raw, err := json.Marshal(entry)
	if err != nil {
		return fmt.Errorf("encode usage event: %w", err)
	}

	line := fmt.Sprintf("%s\n", raw)
	fmt.Fprint(os.Stdout, line)

	usageLogPath := strings.TrimSpace(os.Getenv("LITEPAC_USAGE_LOG"))
	if usageLogPath == "" {
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(usageLogPath), 0o755); err != nil {
		return fmt.Errorf("create usage log directory: %w", err)
	}

	file, err := os.OpenFile(usageLogPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return fmt.Errorf("open usage log: %w", err)
	}
	defer file.Close()

	if _, err := file.WriteString(line); err != nil {
		return fmt.Errorf("write usage log: %w", err)
	}

	readableLogPath := strings.TrimSuffix(usageLogPath, ".ndjson") + ".log"
	readableFile, err := os.OpenFile(readableLogPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return fmt.Errorf("open readable usage log: %w", err)
	}
	defer readableFile.Close()

	localTimestamp := time.Now().Format("2006-01-02 15:04:05")
	if parsedTimestamp, err := time.Parse(time.RFC3339Nano, entry.Timestamp); err == nil {
		localTimestamp = parsedTimestamp.Local().Format("2006-01-02 15:04:05")
	}

	pageLabel := "unknown-page"
	if shellPage, ok := entry.Details["shellPage"].(string); ok && strings.TrimSpace(shellPage) != "" {
		pageLabel = strings.TrimSpace(shellPage)
	}
	if pathName, ok := entry.Details["path"].(string); ok && strings.TrimSpace(pathName) != "" {
		pageLabel = strings.TrimSpace(pathName)
	}

	mapLabel := ""
	if mapName, ok := entry.Details["mapName"].(string); ok && strings.TrimSpace(mapName) != "" {
		mapLabel = fmt.Sprintf(" | %s", strings.TrimSpace(mapName))
	}

	matchLabel := ""
	if matchID, ok := entry.Details["matchId"].(string); ok && strings.TrimSpace(matchID) != "" {
		matchLabel = fmt.Sprintf(" | match=%s", strings.TrimSpace(matchID))
	}

	statusLabel := ""
	if errorText, ok := entry.Details["error"].(string); ok && strings.TrimSpace(errorText) != "" {
		statusLabel = fmt.Sprintf(" | error=%s", strings.TrimSpace(errorText))
	}

	if _, err := fmt.Fprintf(readableFile, "[%s] %s | %s%s%s%s\n", localTimestamp, entry.Event, pageLabel, mapLabel, matchLabel, statusLabel); err != nil {
		return fmt.Errorf("write readable usage log: %w", err)
	}

	return nil
}
