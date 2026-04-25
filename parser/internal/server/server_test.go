package server

import (
	"errors"
	"strings"
	"testing"
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
