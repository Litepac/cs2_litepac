package server

import (
	"bufio"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"mastermind/parser/internal/demo"
)

const (
	defaultMaxUploadBytes       int64 = 512 << 20
	defaultMaxConcurrentParses        = 1
	defaultParseStartsPerHour         = 6
	defaultFeedbackPerMinute          = 20
	defaultUsageEventsPerMinute       = 240

	serverReadHeaderTimeout = 10 * time.Second
	serverReadTimeout       = 10 * time.Minute
	serverWriteTimeout      = 30 * time.Minute
	serverIdleTimeout       = 60 * time.Second
	serverMaxHeaderBytes    = 1 << 20
	maxLimiterClients       = 1024
)

type Options struct {
	ListenAddr          string
	SchemaPath          string
	AssetsRoot          string
	TempDir             string
	MaxUploadBytes      int64
	MaxConcurrentParses int
	AllowedOrigin       string
}

type requestLimiter struct {
	mu      sync.Mutex
	limit   int
	window  time.Duration
	clients map[string]requestLimitWindow
}

type requestLimitWindow struct {
	started time.Time
	count   int
}

type serverState struct {
	parseSlots       chan struct{}
	parseStarts      *requestLimiter
	feedbackRequests *requestLimiter
	usageRequests    *requestLimiter
}

func Serve(opts Options) error {
	return newHTTPServer(opts).ListenAndServe()
}

func newHTTPServer(opts Options) *http.Server {
	addr := strings.TrimSpace(opts.ListenAddr)
	if addr == "" {
		addr = "127.0.0.1:4318"
	}

	return &http.Server{
		Addr:              addr,
		Handler:           newHandler(opts),
		ReadHeaderTimeout: serverReadHeaderTimeout,
		ReadTimeout:       serverReadTimeout,
		WriteTimeout:      serverWriteTimeout,
		IdleTimeout:       serverIdleTimeout,
		MaxHeaderBytes:    serverMaxHeaderBytes,
	}
}

func newHandler(opts Options) http.Handler {
	return newHandlerWithState(opts, newServerState(opts))
}

func newServerState(opts Options) *serverState {
	maxConcurrentParses := opts.MaxConcurrentParses
	if maxConcurrentParses <= 0 {
		maxConcurrentParses = defaultMaxConcurrentParses
	}

	return &serverState{
		parseSlots:       make(chan struct{}, maxConcurrentParses),
		parseStarts:      newRequestLimiter(defaultParseStartsPerHour, time.Hour),
		feedbackRequests: newRequestLimiter(defaultFeedbackPerMinute, time.Minute),
		usageRequests:    newRequestLimiter(defaultUsageEventsPerMinute, time.Minute),
	}
}

func newRequestLimiter(limit int, window time.Duration) *requestLimiter {
	return &requestLimiter{
		limit:   limit,
		window:  window,
		clients: make(map[string]requestLimitWindow),
	}
}

func (limiter *requestLimiter) allow(client string, now time.Time) (bool, time.Duration) {
	limiter.mu.Lock()
	defer limiter.mu.Unlock()

	window, ok := limiter.clients[client]
	if !ok && len(limiter.clients) >= maxLimiterClients {
		for key, candidate := range limiter.clients {
			if now.Sub(candidate.started) >= limiter.window {
				delete(limiter.clients, key)
			}
		}
		if len(limiter.clients) >= maxLimiterClients {
			client = "overflow"
			window, ok = limiter.clients[client]
			if !ok {
				for key := range limiter.clients {
					delete(limiter.clients, key)
					break
				}
			}
		}
	}

	if !ok || window.started.IsZero() || now.Sub(window.started) >= limiter.window {
		window = requestLimitWindow{started: now}
	}

	if window.count >= limiter.limit {
		retryAfter := limiter.window - now.Sub(window.started)
		if retryAfter < time.Second {
			retryAfter = time.Second
		}
		return false, retryAfter
	}

	window.count++
	limiter.clients[client] = window
	return true, 0
}

func newHandlerWithState(opts Options, state *serverState) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		if !allowCORS(w, r, opts) {
			writeJSONError(w, http.StatusForbidden, "origin not allowed")
			return
		}
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
		if !allowCORS(w, r, opts) {
			writeJSONError(w, http.StatusForbidden, "origin not allowed")
			return
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		if r.Method != http.MethodPost {
			writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}

		select {
		case state.parseSlots <- struct{}{}:
			defer func() { <-state.parseSlots }()
		default:
			writeRateLimitError(w, time.Minute, "another demo is already being parsed")
			return
		}

		if allowed, retryAfter := state.parseStarts.allow(clientKey(r), time.Now()); !allowed {
			writeRateLimitError(w, retryAfter, "demo parse limit reached")
			return
		}

		if err := parseDemoUpload(w, r, opts); err != nil {
			writeJSONError(w, requestErrorStatus(err), err.Error())
			return
		}
	})
	mux.HandleFunc("/api/usage-events", func(w http.ResponseWriter, r *http.Request) {
		if !allowCORS(w, r, opts) {
			writeJSONError(w, http.StatusForbidden, "origin not allowed")
			return
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		if r.Method != http.MethodPost {
			writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}

		if allowed, retryAfter := state.usageRequests.allow(clientKey(r), time.Now()); !allowed {
			writeRateLimitError(w, retryAfter, "usage event limit reached")
			return
		}

		r.Body = http.MaxBytesReader(w, r.Body, maxUsageEventBytes)
		if err := appendUsageEvent(r); err != nil {
			fmt.Fprintf(os.Stderr, "usage-event logging failed: %v\n", err)
			writeJSONError(w, requestErrorStatus(err), err.Error())
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})
	mux.HandleFunc("/api/feedback", func(w http.ResponseWriter, r *http.Request) {
		if !allowCORS(w, r, opts) {
			writeJSONError(w, http.StatusForbidden, "origin not allowed")
			return
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		if r.Method != http.MethodPost {
			writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}

		if allowed, retryAfter := state.feedbackRequests.allow(clientKey(r), time.Now()); !allowed {
			writeRateLimitError(w, retryAfter, "feedback submission limit reached")
			return
		}

		r.Body = http.MaxBytesReader(w, r.Body, maxFeedbackBytes)
		if err := appendFeedbackSubmission(r); err != nil {
			writeJSONError(w, requestErrorStatus(err), err.Error())
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})

	return mux
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
		return "Demo processing failed."
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

func allowCORS(w http.ResponseWriter, r *http.Request, opts Options) bool {
	allowed := allowedOrigin(opts)
	origin := strings.TrimSpace(r.Header.Get("Origin"))
	if allowed == "" {
		return origin == "" || originMatchesHost(origin, r.Host)
	}

	if allowed != "*" && origin != "" && origin != allowed {
		return false
	}

	w.Header().Add("Vary", "Origin")
	w.Header().Set("Access-Control-Allow-Origin", allowed)
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	return true
}

func maxUploadBytes(opts Options) int64 {
	if opts.MaxUploadBytes > 0 {
		return opts.MaxUploadBytes
	}

	return defaultMaxUploadBytes
}

func allowedOrigin(opts Options) string {
	return strings.TrimSpace(opts.AllowedOrigin)
}

func originMatchesHost(origin string, requestHost string) bool {
	parsed, err := url.Parse(origin)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" || parsed.User != nil {
		return false
	}
	return strings.EqualFold(parsed.Host, strings.TrimSpace(requestHost))
}

func clientKey(r *http.Request) string {
	directIP := remoteIP(r.RemoteAddr)
	if directIP != nil && directIP.IsLoopback() {
		for _, candidate := range []string{
			r.Header.Get("CF-Connecting-IP"),
			strings.Split(r.Header.Get("X-Forwarded-For"), ",")[0],
		} {
			if ip := net.ParseIP(strings.TrimSpace(candidate)); ip != nil {
				return ip.String()
			}
		}
	}

	if directIP != nil {
		return directIP.String()
	}
	return "unknown"
}

func remoteIP(remoteAddr string) net.IP {
	host, _, err := net.SplitHostPort(strings.TrimSpace(remoteAddr))
	if err == nil {
		if ip := net.ParseIP(host); ip != nil {
			return ip
		}
	}
	if ip := net.ParseIP(strings.TrimSpace(remoteAddr)); ip != nil {
		return ip
	}
	return nil
}

func requestErrorStatus(err error) int {
	var maxBytesError *http.MaxBytesError
	if errors.As(err, &maxBytesError) {
		return http.StatusRequestEntityTooLarge
	}
	return http.StatusBadRequest
}

func writeRateLimitError(w http.ResponseWriter, retryAfter time.Duration, message string) {
	seconds := int(retryAfter.Round(time.Second) / time.Second)
	if seconds < 1 {
		seconds = 1
	}
	w.Header().Set("Retry-After", fmt.Sprintf("%d", seconds))
	writeJSONError(w, http.StatusTooManyRequests, message)
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
