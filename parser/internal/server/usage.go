package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"
)

const maxUsageEventBytes = 32 << 10
const maxUsageEventNameLength = 128

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
	if err := decodeSingleJSON(r.Body, &eventRequest); err != nil {
		return fmt.Errorf("decode usage event: %w", err)
	}

	eventName := strings.TrimSpace(eventRequest.Event)
	if eventName == "" {
		eventName = "unknown"
	}
	if len([]rune(eventName)) > maxUsageEventNameLength {
		return fmt.Errorf("usage event name is too long")
	}

	entry := usageEventLogEntry{
		Event:     eventName,
		Details:   eventRequest.Details,
		Host:      boundedLogValue(r.Host),
		Method:    r.Method,
		Origin:    boundedLogValue(r.Header.Get("Origin")),
		Path:      r.URL.Path,
		Remote:    boundedLogValue(r.RemoteAddr),
		Timestamp: time.Now().UTC().Format(time.RFC3339Nano),
		UserAgent: boundedLogValue(r.UserAgent()),
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

	localTimestamp := time.Now().Format("2006-01-02 15:04:05")
	if parsedTimestamp, err := time.Parse(time.RFC3339Nano, entry.Timestamp); err == nil {
		localTimestamp = parsedTimestamp.Local().Format("2006-01-02 15:04:05")
	}

	pageLabel := "unknown-page"
	if shellPage, ok := entry.Details["shellPage"].(string); ok && strings.TrimSpace(shellPage) != "" {
		pageLabel = boundedLogValue(strings.TrimSpace(shellPage))
	}
	if pathName, ok := entry.Details["path"].(string); ok && strings.TrimSpace(pathName) != "" {
		pageLabel = boundedLogValue(strings.TrimSpace(pathName))
	}

	mapLabel := ""
	if mapName, ok := entry.Details["mapName"].(string); ok && strings.TrimSpace(mapName) != "" {
		mapLabel = fmt.Sprintf(" | %s", boundedLogValue(strings.TrimSpace(mapName)))
	}

	matchLabel := ""
	if matchID, ok := entry.Details["matchId"].(string); ok && strings.TrimSpace(matchID) != "" {
		matchLabel = fmt.Sprintf(" | match=%s", boundedLogValue(strings.TrimSpace(matchID)))
	}

	statusLabel := ""
	if errorText, ok := entry.Details["error"].(string); ok && strings.TrimSpace(errorText) != "" {
		statusLabel = fmt.Sprintf(" | error=%s", boundedLogValue(strings.TrimSpace(errorText)))
	}

	readableLine := fmt.Sprintf("[%s] %s | %s%s%s%s\n", localTimestamp, entry.Event, pageLabel, mapLabel, matchLabel, statusLabel)
	return appendTelemetryLogs(usageLogPath, line, readableLine)
}
