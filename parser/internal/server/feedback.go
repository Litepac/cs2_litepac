package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"
)

const maxFeedbackBytes = 32 << 10
const maxFeedbackTextLength = 4000

type feedbackRequest struct {
	Context map[string]any `json:"context"`
	Message string         `json:"message"`
}

type feedbackLogEntry struct {
	Context   map[string]any `json:"context,omitempty"`
	Host      string         `json:"host,omitempty"`
	Message   string         `json:"message"`
	Method    string         `json:"method"`
	Origin    string         `json:"origin,omitempty"`
	Path      string         `json:"path"`
	Remote    string         `json:"remote,omitempty"`
	Timestamp string         `json:"timestamp"`
	UserAgent string         `json:"userAgent,omitempty"`
}

func appendFeedbackSubmission(r *http.Request) error {
	defer r.Body.Close()

	var submission feedbackRequest
	if err := decodeSingleJSON(r.Body, &submission); err != nil {
		return fmt.Errorf("decode feedback: %w", err)
	}

	message := strings.TrimSpace(submission.Message)
	if message == "" {
		return fmt.Errorf("feedback message is required")
	}
	if len([]rune(message)) > maxFeedbackTextLength {
		return fmt.Errorf("feedback message is too long")
	}

	entry := feedbackLogEntry{
		Context:   submission.Context,
		Host:      boundedLogValue(r.Host),
		Message:   message,
		Method:    r.Method,
		Origin:    boundedLogValue(r.Header.Get("Origin")),
		Path:      r.URL.Path,
		Remote:    boundedLogValue(r.RemoteAddr),
		Timestamp: time.Now().UTC().Format(time.RFC3339Nano),
		UserAgent: boundedLogValue(r.UserAgent()),
	}

	raw, err := json.Marshal(entry)
	if err != nil {
		return fmt.Errorf("encode feedback: %w", err)
	}

	line := fmt.Sprintf("%s\n", raw)
	fmt.Fprint(os.Stdout, line)

	feedbackLogPath := strings.TrimSpace(os.Getenv("LITEPAC_FEEDBACK_LOG"))
	if feedbackLogPath == "" {
		return nil
	}

	pageLabel := "unknown-page"
	if shellPage, ok := entry.Context["shellPage"].(string); ok && strings.TrimSpace(shellPage) != "" {
		pageLabel = boundedLogValue(strings.TrimSpace(shellPage))
	}
	mapLabel := ""
	if mapName, ok := entry.Context["mapName"].(string); ok && strings.TrimSpace(mapName) != "" {
		mapLabel = fmt.Sprintf(" | %s", boundedLogValue(strings.TrimSpace(mapName)))
	}
	roundLabel := ""
	if roundNumber, ok := entry.Context["replayRoundNumber"].(float64); ok {
		roundLabel = fmt.Sprintf(" | R%.0f", roundNumber)
	}

	localTimestamp := time.Now().Format("2006-01-02 15:04:05")
	if parsedTimestamp, err := time.Parse(time.RFC3339Nano, entry.Timestamp); err == nil {
		localTimestamp = parsedTimestamp.Local().Format("2006-01-02 15:04:05")
	}

	readableLine := fmt.Sprintf("[%s] %s%s%s\n%s\n\n", localTimestamp, pageLabel, mapLabel, roundLabel, entry.Message)
	return appendTelemetryLogs(feedbackLogPath, line, readableLine)
}
