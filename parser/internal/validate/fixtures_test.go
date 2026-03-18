package validate_test

import (
	"encoding/json"
	"os"
	"path/filepath"
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

			actual := summarize(data, expected.ReplayFile)
			if actual != expected {
				t.Fatalf("fixture summary mismatch\nactual:   %+v\nexpected: %+v", actual, expected)
			}
		})
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
