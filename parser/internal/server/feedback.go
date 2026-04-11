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
	if err := json.NewDecoder(io.LimitReader(r.Body, maxFeedbackBytes)).Decode(&submission); err != nil {
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
		Host:      r.Host,
		Message:   message,
		Method:    r.Method,
		Origin:    r.Header.Get("Origin"),
		Path:      r.URL.Path,
		Remote:    r.RemoteAddr,
		Timestamp: time.Now().UTC().Format(time.RFC3339Nano),
		UserAgent: r.UserAgent(),
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
	if err := os.MkdirAll(filepath.Dir(feedbackLogPath), 0o755); err != nil {
		return fmt.Errorf("create feedback log directory: %w", err)
	}

	file, err := os.OpenFile(feedbackLogPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return fmt.Errorf("open feedback log: %w", err)
	}
	defer file.Close()

	if _, err := file.WriteString(line); err != nil {
		return fmt.Errorf("write feedback log: %w", err)
	}

	readableLogPath := strings.TrimSuffix(feedbackLogPath, ".ndjson") + ".log"
	readableFile, err := os.OpenFile(readableLogPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return fmt.Errorf("open readable feedback log: %w", err)
	}
	defer readableFile.Close()

	pageLabel := "unknown-page"
	if shellPage, ok := entry.Context["shellPage"].(string); ok && strings.TrimSpace(shellPage) != "" {
		pageLabel = strings.TrimSpace(shellPage)
	}
	mapLabel := ""
	if mapName, ok := entry.Context["mapName"].(string); ok && strings.TrimSpace(mapName) != "" {
		mapLabel = fmt.Sprintf(" | %s", strings.TrimSpace(mapName))
	}
	roundLabel := ""
	if roundNumber, ok := entry.Context["replayRoundNumber"].(float64); ok {
		roundLabel = fmt.Sprintf(" | R%.0f", roundNumber)
	}

	localTimestamp := time.Now().Format("2006-01-02 15:04:05")
	if parsedTimestamp, err := time.Parse(time.RFC3339Nano, entry.Timestamp); err == nil {
		localTimestamp = parsedTimestamp.Local().Format("2006-01-02 15:04:05")
	}

	if _, err := fmt.Fprintf(readableFile, "[%s] %s%s%s\n%s\n\n", localTimestamp, pageLabel, mapLabel, roundLabel, entry.Message); err != nil {
		return fmt.Errorf("write readable feedback log: %w", err)
	}

	return nil
}
