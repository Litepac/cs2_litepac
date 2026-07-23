package demo

import (
	"path/filepath"
	"strings"
	"testing"

	"mastermind/parser/internal/replay"
)

func TestSourceDemoFileNameUsesExplicitInputName(t *testing.T) {
	tempPath := filepath.Join(t.TempDir(), "mastermind-upload-123.dem")
	opts := Options{
		DemoPath:       tempPath,
		SourceFileName: filepath.Join("incoming", "match.dem"),
	}

	if got := sourceDemoFileName(opts); got != "match.dem" {
		t.Fatalf("expected explicit source name, got %q", got)
	}
}

func TestSourceDemoFileNameFallsBackToDemoPath(t *testing.T) {
	tempPath := filepath.Join(t.TempDir(), "local-match.dem")

	if got := sourceDemoFileName(Options{DemoPath: tempPath}); got != "local-match.dem" {
		t.Fatalf("expected demo path base name, got %q", got)
	}
}

func TestOrderedTeamsUsesStableTeamIDOrder(t *testing.T) {
	teams := orderedTeams(map[string]teamRef{
		"team:3": {Team: replay.Team{TeamID: "team:3"}},
		"team:2": {Team: replay.Team{TeamID: "team:2"}},
	})

	if len(teams) != 2 || teams[0].TeamID != "team:2" || teams[1].TeamID != "team:3" {
		t.Fatalf("unexpected team order: %+v", teams)
	}
}

func TestOrderedPlayersUsesStableTeamAndPlayerIDOrder(t *testing.T) {
	players := orderedPlayers(map[string]playerRef{
		"steam:30": {Player: replay.Player{PlayerID: "steam:30", TeamID: "team:3"}},
		"steam:22": {Player: replay.Player{PlayerID: "steam:22", TeamID: "team:2"}},
		"steam:21": {Player: replay.Player{PlayerID: "steam:21", TeamID: "team:2"}},
	})

	got := []string{players[0].PlayerID, players[1].PlayerID, players[2].PlayerID}
	want := []string{"steam:21", "steam:22", "steam:30"}
	for index := range want {
		if got[index] != want[index] {
			t.Fatalf("unexpected player order: %v", got)
		}
	}
}

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
