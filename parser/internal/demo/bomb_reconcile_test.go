package demo

import "testing"

func TestBombCarrierTransitionEvents(t *testing.T) {
	t.Run("no change yields no events", func(t *testing.T) {
		events := bombCarrierTransitionEvents("player:a", "player:a")
		if len(events) != 0 {
			t.Fatalf("expected no transition events, got %d", len(events))
		}
	})

	t.Run("ground to carrier yields pickup", func(t *testing.T) {
		events := bombCarrierTransitionEvents("", "player:a")
		if len(events) != 1 || events[0].eventType != "pickup" || events[0].playerID == nil || *events[0].playerID != "player:a" {
			t.Fatalf("expected pickup for player:a, got %#v", events)
		}
	})

	t.Run("carrier to ground yields drop", func(t *testing.T) {
		events := bombCarrierTransitionEvents("player:a", "")
		if len(events) != 1 || events[0].eventType != "drop" || events[0].playerID == nil || *events[0].playerID != "player:a" {
			t.Fatalf("expected drop for player:a, got %#v", events)
		}
	})

	t.Run("carrier swap yields drop then pickup", func(t *testing.T) {
		events := bombCarrierTransitionEvents("player:a", "player:b")
		if len(events) != 2 {
			t.Fatalf("expected 2 transition events, got %d", len(events))
		}
		if events[0].eventType != "drop" || events[0].playerID == nil || *events[0].playerID != "player:a" {
			t.Fatalf("expected first event to be drop for player:a, got %#v", events[0])
		}
		if events[1].eventType != "pickup" || events[1].playerID == nil || *events[1].playerID != "player:b" {
			t.Fatalf("expected second event to be pickup for player:b, got %#v", events[1])
		}
	})
}
