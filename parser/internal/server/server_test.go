package server

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestUploadParseErrorRemovesDemoinfocsStackTrace(t *testing.T) {
	message := uploadParseError(
		"overpass_4k_3k.dem",
		errors.New("parse demo: unable to find existing entity 524357 stacktrace: goroutine 406 [running]: runtime/debug.Stack()"),
	)

	if strings.Contains(message, "stacktrace") || strings.Contains(message, "goroutine") {
		t.Fatalf("expected stack trace to be removed, got %q", message)
	}
	if !strings.Contains(message, "entity data") {
		t.Fatalf("expected unsupported entity state copy, got %q", message)
	}
}

func TestStripGoStackTraceKeepsPlainErrors(t *testing.T) {
	const message = "parse demo: unsupported map de_unknown"
	if got := stripGoStackTrace(message); got != message {
		t.Fatalf("expected plain error to remain unchanged, got %q", got)
	}
}

func TestHTTPServerHasBoundedTimeouts(t *testing.T) {
	httpServer := newHTTPServer(Options{})

	if httpServer.ReadHeaderTimeout != serverReadHeaderTimeout {
		t.Fatalf("unexpected read header timeout: %s", httpServer.ReadHeaderTimeout)
	}
	if httpServer.ReadTimeout != serverReadTimeout {
		t.Fatalf("unexpected read timeout: %s", httpServer.ReadTimeout)
	}
	if httpServer.WriteTimeout != serverWriteTimeout {
		t.Fatalf("unexpected write timeout: %s", httpServer.WriteTimeout)
	}
	if httpServer.IdleTimeout != serverIdleTimeout {
		t.Fatalf("unexpected idle timeout: %s", httpServer.IdleTimeout)
	}
	if httpServer.MaxHeaderBytes != serverMaxHeaderBytes {
		t.Fatalf("unexpected maximum header size: %d", httpServer.MaxHeaderBytes)
	}
}

func TestDefaultUploadLimitIsConservative(t *testing.T) {
	if got := maxUploadBytes(Options{}); got != 512<<20 {
		t.Fatalf("expected 512 MiB default upload limit, got %d", got)
	}
}

func TestDefaultCORSRejectsCrossOriginBrowserRequest(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	request.Header.Set("Origin", "https://example.test")
	response := httptest.NewRecorder()

	newHandler(Options{}).ServeHTTP(response, request)

	if response.Code != http.StatusForbidden {
		t.Fatalf("expected cross-origin request to be rejected, got %d", response.Code)
	}
	if got := response.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("expected no default CORS header, got %q", got)
	}
}

func TestDefaultCORSAllowsMatchingOriginWithoutCORSHeader(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, "http://friends.example/api/health", nil)
	request.Header.Set("Origin", "http://friends.example")
	response := httptest.NewRecorder()

	newHandler(Options{}).ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected same-origin health request to succeed, got %d", response.Code)
	}
	if got := response.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("expected no CORS header for same-origin mode, got %q", got)
	}
}

func TestConfiguredCORSRejectsDifferentOrigin(t *testing.T) {
	opts := Options{AllowedOrigin: "https://friends.example"}
	request := httptest.NewRequest(http.MethodPost, "/api/feedback", strings.NewReader(`{"message":"hello"}`))
	request.Header.Set("Origin", "https://attacker.example")
	response := httptest.NewRecorder()

	newHandler(opts).ServeHTTP(response, request)

	if response.Code != http.StatusForbidden {
		t.Fatalf("expected forbidden response, got %d", response.Code)
	}
}

func TestConfiguredCORSAllowsExactOrigin(t *testing.T) {
	opts := Options{AllowedOrigin: "https://friends.example"}
	request := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	request.Header.Set("Origin", "https://friends.example")
	response := httptest.NewRecorder()

	newHandler(opts).ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected health request to succeed, got %d", response.Code)
	}
	if got := response.Header().Get("Access-Control-Allow-Origin"); got != opts.AllowedOrigin {
		t.Fatalf("expected configured CORS origin, got %q", got)
	}
}

func TestParseEndpointRejectsConcurrentParse(t *testing.T) {
	state := newServerState(Options{})
	state.parseSlots <- struct{}{}

	request := httptest.NewRequest(http.MethodPost, "/api/parse-demo", nil)
	response := httptest.NewRecorder()
	newHandlerWithState(Options{}, state).ServeHTTP(response, request)

	if response.Code != http.StatusTooManyRequests {
		t.Fatalf("expected concurrent parse to be rejected, got %d", response.Code)
	}
	if response.Header().Get("Retry-After") == "" {
		t.Fatal("expected rate-limited response to include Retry-After")
	}
}

func TestFeedbackEndpointRejectsOversizedBody(t *testing.T) {
	body := `{"message":"` + strings.Repeat("x", maxFeedbackBytes) + `"}`
	request := httptest.NewRequest(http.MethodPost, "/api/feedback", strings.NewReader(body))
	response := httptest.NewRecorder()

	newHandler(Options{}).ServeHTTP(response, request)

	if response.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("expected oversized feedback to return 413, got %d: %s", response.Code, response.Body.String())
	}
}

func TestUsageEndpointRejectsTrailingJSON(t *testing.T) {
	t.Setenv("LITEPAC_USAGE_LOG", "")
	request := httptest.NewRequest(
		http.MethodPost,
		"/api/usage-events",
		strings.NewReader(`{"event":"opened"}{"event":"second"}`),
	)
	response := httptest.NewRecorder()

	newHandler(Options{}).ServeHTTP(response, request)

	if response.Code != http.StatusBadRequest {
		t.Fatalf("expected trailing JSON to return 400, got %d", response.Code)
	}
}

func TestUsageEndpointRateLimit(t *testing.T) {
	t.Setenv("LITEPAC_USAGE_LOG", "")
	state := newServerState(Options{})
	state.usageRequests = newRequestLimiter(1, time.Hour)
	handler := newHandlerWithState(Options{}, state)

	first := httptest.NewRecorder()
	handler.ServeHTTP(
		first,
		httptest.NewRequest(http.MethodPost, "/api/usage-events", strings.NewReader(`{"event":"opened"}`)),
	)
	if first.Code != http.StatusNoContent {
		t.Fatalf("expected first usage event to succeed, got %d", first.Code)
	}

	second := httptest.NewRecorder()
	handler.ServeHTTP(
		second,
		httptest.NewRequest(http.MethodPost, "/api/usage-events", strings.NewReader(`{"event":"opened"}`)),
	)
	if second.Code != http.StatusTooManyRequests {
		t.Fatalf("expected second usage event to be rate limited, got %d", second.Code)
	}
}

func TestRequestLimiterSeparatesClients(t *testing.T) {
	limiter := newRequestLimiter(1, time.Hour)
	now := time.Now()

	if allowed, _ := limiter.allow("198.51.100.1", now); !allowed {
		t.Fatal("expected first client request to be allowed")
	}
	if allowed, _ := limiter.allow("198.51.100.1", now); allowed {
		t.Fatal("expected repeated client request to be limited")
	}
	if allowed, _ := limiter.allow("198.51.100.2", now); !allowed {
		t.Fatal("expected a different client to have an independent limit")
	}
}

func TestClientKeyPrefersCloudflareAddress(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	request.RemoteAddr = "127.0.0.1:4318"
	request.Header.Set("CF-Connecting-IP", "203.0.113.9")

	if got := clientKey(request); got != "203.0.113.9" {
		t.Fatalf("expected Cloudflare client address, got %q", got)
	}
}

func TestClientKeyIgnoresForwardedAddressFromUntrustedPeer(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	request.RemoteAddr = "198.51.100.8:12345"
	request.Header.Set("CF-Connecting-IP", "203.0.113.9")
	request.Header.Set("X-Forwarded-For", "203.0.113.10")

	if got := clientKey(request); got != "198.51.100.8" {
		t.Fatalf("expected direct peer address, got %q", got)
	}
}

func TestTelemetryLogRefusesWritesPastCapacity(t *testing.T) {
	logPath := filepath.Join(t.TempDir(), "usage.ndjson")
	if err := os.WriteFile(logPath, nil, 0o644); err != nil {
		t.Fatalf("create log file: %v", err)
	}
	if err := os.Truncate(logPath, maxTelemetryLogBytes); err != nil {
		t.Fatalf("fill log file: %v", err)
	}

	if err := appendTelemetryLogs(logPath, "{}\n", "event\n"); err == nil {
		t.Fatal("expected full telemetry log to reject another write")
	}
}
