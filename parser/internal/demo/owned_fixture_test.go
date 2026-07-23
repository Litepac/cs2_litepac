package demo

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"mastermind/parser/internal/replay"
)

const ownedDemoSHA256 = "e1eb40e70f5e2a947b20824935b6c199500579556a8b3900b2f377e48ce78cfa"

func TestOwnedDemoExtractionRegression(t *testing.T) {
	repoRoot := filepath.Join("..", "..", "..")
	demoPath := filepath.Join(repoRoot, "testdata", "demos", "ci-owned-bot.dem")
	outputPath := filepath.Join(t.TempDir(), "ci-owned-bot.replay.json")

	info, err := os.Stat(demoPath)
	if err != nil {
		t.Fatalf("owned demo fixture missing: %v", err)
	}
	if info.Size() != 452923 {
		t.Fatalf("owned demo size changed: got %d bytes", info.Size())
	}

	err = Parse(Options{
		DemoPath:       demoPath,
		SourceFileName: "ci-owned-bot.dem",
		OutputPath:     outputPath,
		SchemaPath:     filepath.Join(repoRoot, "schema", "mastermind.replay.schema.json"),
		AssetsRoot:     filepath.Join(repoRoot, "public", "maps"),
		ExpectedRounds: 1,
	})
	if err != nil {
		t.Fatalf("parse owned demo fixture: %v", err)
	}

	raw, err := os.ReadFile(outputPath)
	if err != nil {
		t.Fatalf("read extracted replay: %v", err)
	}

	var data replay.Replay
	if err := json.Unmarshal(raw, &data); err != nil {
		t.Fatalf("decode extracted replay: %v", err)
	}

	if !strings.EqualFold(data.SourceDemo.SHA256, ownedDemoSHA256) {
		t.Fatalf("source hash mismatch: got %q", data.SourceDemo.SHA256)
	}
	if data.SourceDemo.FileName != "ci-owned-bot.dem" || data.SourceDemo.TickCount != 1313 {
		t.Fatalf("unexpected source metadata: %+v", data.SourceDemo)
	}
	if data.Format != replay.FormatName || data.SchemaVersion != replay.SchemaVersion {
		t.Fatalf("unexpected replay identity: format=%q schemaVersion=%q", data.Format, data.SchemaVersion)
	}
	if data.Map.MapID != "de_mirage" || data.Match.TickRate != 64 {
		t.Fatalf("unexpected match identity: map=%q tickRate=%.2f", data.Map.MapID, data.Match.TickRate)
	}
	if len(data.Teams) != 2 || len(data.Players) != 2 {
		t.Fatalf("expected two bot teams and players, got teams=%d players=%d", len(data.Teams), len(data.Players))
	}
	for _, player := range data.Players {
		if player.SteamID != nil {
			t.Fatalf("owned fixture must remain anonymous, player %q has SteamID %q", player.DisplayName, *player.SteamID)
		}
	}

	if data.Match.TotalRounds != 1 || len(data.Rounds) != 1 {
		t.Fatalf("expected one extracted round, got match total %d and %d round records", data.Match.TotalRounds, len(data.Rounds))
	}
	round := data.Rounds[0]
	if round.StartTick != 416 || round.EndTick != 1119 || round.OfficialEndTick == nil || *round.OfficialEndTick != 1313 {
		t.Fatalf(
			"unexpected round boundaries: start=%d end=%d official=%v",
			round.StartTick,
			round.EndTick,
			round.OfficialEndTick,
		)
	}
	if len(round.PlayerStreams) != 2 || len(round.KillEvents) != 1 || len(round.HurtEvents) != 2 || len(round.FireEvents) != 2 {
		t.Fatalf(
			"unexpected round activity: streams=%d kills=%d hurts=%d fires=%d",
			len(round.PlayerStreams),
			len(round.KillEvents),
			len(round.HurtEvents),
			len(round.FireEvents),
		)
	}
	for _, stream := range round.PlayerStreams {
		if len(stream.X) == 0 {
			t.Fatalf("player %q has an empty position stream", stream.PlayerID)
		}
	}
	if len(round.BombEvents) != 1 || round.BombEvents[0].Type != "drop" {
		t.Fatalf("expected one grounded bomb-drop event, got %+v", round.BombEvents)
	}
	if len(round.UtilityEntities) != 0 {
		t.Fatalf("expected no utility in controlled fixture, got %d", len(round.UtilityEntities))
	}
}
