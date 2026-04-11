package demo

import (
	"strings"
	"testing"

	"mastermind/parser/internal/replay"
)

func TestSyntheticPlayerIDWarnings(t *testing.T) {
	warnings := syntheticPlayerIDWarnings([]replay.Player{
		{PlayerID: "player:gunner:13", DisplayName: "Gunner", SteamID: nil},
		{PlayerID: "player:gunner:14", DisplayName: "Gunner", SteamID: nil},
		{PlayerID: "steam:123", DisplayName: "Gunner", SteamID: replay.String("123")},
		{PlayerID: "player:anchor:15", DisplayName: "Anchor", SteamID: nil},
	})

	if len(warnings) != 1 {
		t.Fatalf("expected one duplicate warning, got %d: %v", len(warnings), warnings)
	}

	if !strings.Contains(warnings[0], `"Gunner"`) {
		t.Fatalf("expected warning to include display name, got %q", warnings[0])
	}

	if !strings.Contains(warnings[0], "player:gunner:13") || !strings.Contains(warnings[0], "player:gunner:14") {
		t.Fatalf("expected warning to include both synthetic IDs, got %q", warnings[0])
	}
}
