package events

import (
	"testing"
	"time"
)

func TestFlashDurationTicks(t *testing.T) {
	ticks, ok := FlashDurationTicks(2750*time.Millisecond, 64)
	if !ok {
		t.Fatalf("expected valid flash duration")
	}

	if ticks != 176 {
		t.Fatalf("expected 176 ticks, got %d", ticks)
	}
}

func TestFlashDurationTicks_Invalid(t *testing.T) {
	if _, ok := FlashDurationTicks(0, 64); ok {
		t.Fatalf("expected zero duration to be rejected")
	}

	if _, ok := FlashDurationTicks(1200*time.Millisecond, 0); ok {
		t.Fatalf("expected zero tick rate to be rejected")
	}
}
