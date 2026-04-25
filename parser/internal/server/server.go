package server

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"mastermind/parser/internal/demo"
)

const defaultMaxUploadBytes int64 = 2 << 30

type Options struct {
	ListenAddr     string
	SchemaPath     string
	AssetsRoot     string
	TempDir        string
	MaxUploadBytes int64
	AllowedOrigin  string
}

func Serve(opts Options) error {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		allowCORS(w, opts)
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		if r.Method != http.MethodGet {
			writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"mode":    "go-api",
			"ok":      true,
			"service": "mastermind-parser-api",
		})
	})
	mux.HandleFunc("/api/parse-demo", func(w http.ResponseWriter, r *http.Request) {
		allowCORS(w, opts)
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		if r.Method != http.MethodPost {
			writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}

		if err := parseDemoUpload(w, r, opts); err != nil {
			writeJSONError(w, http.StatusBadRequest, err.Error())
			return
		}
	})
	mux.HandleFunc("/api/usage-events", func(w http.ResponseWriter, r *http.Request) {
		allowCORS(w, opts)
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		if r.Method != http.MethodPost {
			writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}

		if err := appendUsageEvent(r); err != nil {
			fmt.Fprintf(os.Stderr, "usage-event logging failed: %v\n", err)
		}
		w.WriteHeader(http.StatusNoContent)
	})
	mux.HandleFunc("/api/feedback", func(w http.ResponseWriter, r *http.Request) {
		allowCORS(w, opts)
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		if r.Method != http.MethodPost {
			writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}

		if err := appendFeedbackSubmission(r); err != nil {
			writeJSONError(w, http.StatusBadRequest, err.Error())
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})

	addr := opts.ListenAddr
	if strings.TrimSpace(addr) == "" {
		addr = "127.0.0.1:4318"
	}

	return http.ListenAndServe(addr, mux)
}

func parseDemoUpload(w http.ResponseWriter, r *http.Request, opts Options) error {
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadBytes(opts))
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		return fmt.Errorf("parse multipart form: %w", err)
	}

	file, header, err := r.FormFile("demo")
	if err != nil {
		return fmt.Errorf("read uploaded demo: %w", err)
	}
	defer file.Close()

	tempDir := opts.TempDir
	if strings.TrimSpace(tempDir) == "" {
		tempDir = os.TempDir()
	}
	if err := os.MkdirAll(tempDir, 0o755); err != nil {
		return fmt.Errorf("create temp directory: %w", err)
	}

	baseName := sanitizedBaseName(header.Filename)
	if baseName == "" {
		baseName = "uploaded-demo.dem"
	}

	demoFile, err := os.CreateTemp(tempDir, "mastermind-upload-*.dem")
	if err != nil {
		return fmt.Errorf("create temp demo file: %w", err)
	}
	demoPath := demoFile.Name()
	defer os.Remove(demoPath)
	defer demoFile.Close()

	if _, err := io.Copy(demoFile, file); err != nil {
		return fmt.Errorf("write temp demo file: %w", err)
	}
	if err := demoFile.Close(); err != nil {
		return fmt.Errorf("finalize temp demo file: %w", err)
	}

	replayFile, err := os.CreateTemp(tempDir, "mastermind-replay-*.json")
	if err != nil {
		return fmt.Errorf("create temp replay file: %w", err)
	}
	replayPath := replayFile.Name()
	defer os.Remove(replayPath)
	replayFile.Close()

	flusher, ok := w.(http.Flusher)
	if !ok {
		return fmt.Errorf("streaming not supported by response writer")
	}

	w.Header().Set("Content-Type", "application/x-ndjson")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Accel-Buffering", "no")

	streamEvent := func(payload any) error {
		if err := writeJSONLine(w, payload); err != nil {
			return err
		}
		flusher.Flush()
		return nil
	}

	roundsTotal, err := demo.CountRounds(demoPath)
	if err != nil {
		_ = streamEvent(map[string]any{
			"type":         "progress",
			"roundsParsed": 0,
		})
	} else if roundsTotal > 0 {
		_ = streamEvent(map[string]any{
			"type":         "progress",
			"roundsParsed": 0,
			"roundsTotal":  roundsTotal,
		})
	}

	if err := demo.Parse(demo.Options{
		DemoPath:       demoPath,
		OutputPath:     replayPath,
		SchemaPath:     opts.SchemaPath,
		AssetsRoot:     opts.AssetsRoot,
		ExpectedRounds: roundsTotal,
		Progress: func(progress demo.ParseProgress) {
			payload := map[string]any{
				"type":         "progress",
				"roundsParsed": progress.RoundsParsed,
			}
			if progress.RoundsTotal > 0 {
				payload["roundsTotal"] = progress.RoundsTotal
			}
			_ = streamEvent(payload)
		},
	}); err != nil {
		_ = streamEvent(map[string]any{
			"type":  "error",
			"error": uploadParseError(baseName, err),
		})
		return nil
	}

	replayInput, err := os.Open(replayPath)
	if err != nil {
		_ = streamEvent(map[string]any{
			"type":  "error",
			"error": fmt.Sprintf("open generated replay: %v", err),
		})
		return nil
	}
	defer replayInput.Close()

	replayRaw, err := io.ReadAll(replayInput)
	if err != nil {
		_ = streamEvent(map[string]any{
			"type":  "error",
			"error": fmt.Sprintf("read generated replay: %v", err),
		})
		return nil
	}

	if !json.Valid(replayRaw) {
		_ = streamEvent(map[string]any{
			"type":  "error",
			"error": "generated replay is not valid JSON",
		})
		return nil
	}

	replayRaw = []byte(strings.TrimSpace(string(replayRaw)))

	if _, err := w.Write([]byte(`{"type":"result","replay":`)); err != nil {
		return fmt.Errorf("stream replay envelope prefix: %w", err)
	}
	if _, err := w.Write(replayRaw); err != nil {
		return fmt.Errorf("stream generated replay body: %w", err)
	}
	if _, err := w.Write([]byte("}\n")); err != nil {
		return fmt.Errorf("stream replay envelope suffix: %w", err)
	}
	flusher.Flush()

	return nil
}

func uploadParseError(fileName string, err error) string {
	if err == nil {
		return "Demo processing failed.";
	}

	raw := strings.TrimSpace(err.Error())
	if raw == "" {
		return fmt.Sprintf("Demo processing failed for %s.", fileName)
	}

	cleaned := stripGoStackTrace(raw)
	normalized := strings.ToLower(cleaned)
	if strings.Contains(normalized, "unable to find existing entity") {
		return fmt.Sprintf(
			"Demo processing failed for %s. This demo uses entity data the current review parser cannot safely read yet.",
			fileName,
		)
	}
	if strings.Contains(normalized, "crashed") {
		return fmt.Sprintf(
			"Demo processing failed for %s. The local review parser hit an unsupported demo state.",
			fileName,
		)
	}

	return fmt.Sprintf("Demo processing failed for %s: %s", fileName, cleaned)
}

func stripGoStackTrace(message string) string {
	for _, marker := range []string{" stacktrace:", "\nstacktrace:", "\ngoroutine "} {
		if index := strings.Index(message, marker); index >= 0 {
			return strings.TrimSpace(message[:index])
		}
	}

	return strings.TrimSpace(message)
}

func allowCORS(w http.ResponseWriter, opts Options) {
	w.Header().Set("Access-Control-Allow-Origin", allowedOrigin(opts))
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
}

func maxUploadBytes(opts Options) int64 {
	if opts.MaxUploadBytes > 0 {
		return opts.MaxUploadBytes
	}

	return defaultMaxUploadBytes
}

func allowedOrigin(opts Options) string {
	origin := strings.TrimSpace(opts.AllowedOrigin)
	if origin != "" {
		return origin
	}

	return "*"
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeJSONError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{
		"error": message,
	})
}

func writeJSONLine(w io.Writer, payload any) error {
	buffered := bufio.NewWriter(w)
	if err := json.NewEncoder(buffered).Encode(payload); err != nil {
		return err
	}
	return buffered.Flush()
}

func sanitizedBaseName(name string) string {
	base := filepath.Base(strings.TrimSpace(name))
	base = strings.ReplaceAll(base, string(filepath.Separator), "_")
	return base
}
