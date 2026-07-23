package validate_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"mastermind/parser/internal/replay"
	"mastermind/parser/internal/validate"
)

type manifest struct {
	Files []manifestEntry `json:"files"`
}

type manifestEntry struct {
	ReplayFile        string  `json:"replayFile"`
	Map               string  `json:"map"`
	Rounds            int     `json:"rounds"`
	Players           int     `json:"players"`
	Teams             int     `json:"teams"`
	TickRate          float64 `json:"tickRate"`
	Kills             int     `json:"kills"`
	BombEvents        int     `json:"bombEvents"`
	Utility           int     `json:"utility"`
	EmptyStreams      int     `json:"emptyStreams"`
	ZeroTrajectories  int     `json:"zeroTrajectories"`
	ShortRounds       int     `json:"shortRounds"`
	LongestRoundTicks int     `json:"longestRoundTicks"`
	SourceDemoSHA256  string  `json:"sourceDemoSha256,omitempty"`
}

func TestReplayFixturesMatchManifest(t *testing.T) {
	repoRoot := filepath.Join("..", "..", "..")
	manifestPath := filepath.Join(repoRoot, "testdata", "goldens", "replay-manifest.json")
	schemaPath := filepath.Join(repoRoot, "schema", "mastermind.replay.schema.json")
	replayDir := filepath.Join(repoRoot, "testdata", "replays")

	if _, err := os.Stat(manifestPath); err != nil {
		t.Fatalf("manifest missing: %v", err)
	}

	if _, err := os.Stat(replayDir); err != nil {
		t.Skip("replay fixtures are not present locally")
	}

	var fixtureManifest manifest
	readJSON(t, manifestPath, &fixtureManifest)

	for _, expected := range fixtureManifest.Files {
		t.Run(expected.ReplayFile, func(t *testing.T) {
			replayPath := filepath.Join(replayDir, expected.ReplayFile)
			if _, err := os.Stat(replayPath); err != nil {
				t.Skipf("replay fixture missing locally: %v", err)
			}

			var data replay.Replay
			readJSON(t, replayPath, &data)

			if err := validate.ValidateSchema(schemaPath, data); err != nil {
				t.Fatalf("schema validation failed: %v", err)
			}
			if err := validate.ValidateReplay(data); err != nil {
				t.Fatalf("semantic validation failed: %v", err)
			}
			if expected.SourceDemoSHA256 != "" && !strings.EqualFold(data.SourceDemo.SHA256, expected.SourceDemoSHA256) {
				t.Fatalf("source demo hash mismatch: got %q, expected %q", data.SourceDemo.SHA256, expected.SourceDemoSHA256)
			}

			actual := summarize(data, expected.ReplayFile)
			actual.SourceDemoSHA256 = expected.SourceDemoSHA256
			if actual != expected {
				t.Fatalf("fixture summary mismatch\nactual:   %+v\nexpected: %+v", actual, expected)
			}
		})
	}
}

func TestCommittedReplayRegression(t *testing.T) {
	repoRoot := filepath.Join("..", "..", "..")
	schemaPath := filepath.Join(repoRoot, "schema", "mastermind.replay.schema.json")
	replayPath := filepath.Join(repoRoot, "testdata", "goldens", "ci-smoke.replay.json")

	var data replay.Replay
	readJSON(t, replayPath, &data)

	if err := validate.ValidateSchema(schemaPath, data); err != nil {
		t.Fatalf("committed replay schema validation failed: %v", err)
	}
	if err := validate.ValidateReplay(data); err != nil {
		t.Fatalf("committed replay semantic validation failed: %v", err)
	}

	if data.Format != replay.FormatName || data.SchemaVersion != replay.SchemaVersion {
		t.Fatalf("unexpected replay identity: format=%q schemaVersion=%q", data.Format, data.SchemaVersion)
	}
	if data.Match.TotalRounds != 1 || len(data.Rounds) != 1 {
		t.Fatalf("expected one committed smoke round, got match total %d and %d round records", data.Match.TotalRounds, len(data.Rounds))
	}
	if len(data.Rounds[0].PlayerStreams) != 1 || len(data.Rounds[0].PlayerStreams[0].X) != 1 {
		t.Fatal("expected committed smoke replay to retain one player sample")
	}
}

func summarize(data replay.Replay, replayFile string) manifestEntry {
	out := manifestEntry{
		ReplayFile: replayFile,
		Map:        data.Map.MapID,
		Rounds:     len(data.Rounds),
		Players:    len(data.Players),
		Teams:      len(data.Teams),
		TickRate:   data.Match.TickRate,
	}

	for _, round := range data.Rounds {
		duration := round.EndTick - round.StartTick
		if duration < 1 {
			out.ShortRounds++
		}
		if duration > out.LongestRoundTicks {
			out.LongestRoundTicks = duration
		}

		out.Kills += len(round.KillEvents)
		out.BombEvents += len(round.BombEvents)
		out.Utility += len(round.UtilityEntities)

		for _, stream := range round.PlayerStreams {
			if len(stream.X) == 0 {
				out.EmptyStreams++
			}
		}

		for _, utility := range round.UtilityEntities {
			if len(utility.Trajectory.X) == 0 {
				out.ZeroTrajectories++
			}
		}
	}

	return out
}

func readJSON(t *testing.T, path string, target any) {
	t.Helper()

	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}

	if err := json.Unmarshal(raw, target); err != nil {
		t.Fatalf("decode %s: %v", path, err)
	}
}
