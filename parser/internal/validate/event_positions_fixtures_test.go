package validate_test

import (
	"os"
	"path/filepath"
	"testing"

	"mastermind/parser/internal/replay"
)

func TestReplayFixturesEventPositionInvariants(t *testing.T) {
	repoRoot := filepath.Join("..", "..", "..")
	manifestPath := filepath.Join(repoRoot, "testdata", "goldens", "replay-manifest.json")
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

			killVictimMissing := 0
			killPlayerBackedKillerMissing := 0
			hurtVictimMissing := 0
			hurtPlayerBackedAttackerMissing := 0
			bombPositionMissing := 0
			bombSiteShapeViolations := 0

			for _, round := range data.Rounds {
				for _, kill := range round.KillEvents {
					if kill.VictimX == nil || kill.VictimY == nil || kill.VictimZ == nil {
						killVictimMissing++
					}
					if kill.KillerPlayerID != nil && (kill.KillerX == nil || kill.KillerY == nil || kill.KillerZ == nil) {
						killPlayerBackedKillerMissing++
					}
				}

				for _, hurt := range round.HurtEvents {
					if hurt.VictimX == nil || hurt.VictimY == nil || hurt.VictimZ == nil {
						hurtVictimMissing++
					}
					if hurt.AttackerPlayerID != nil && (hurt.AttackerX == nil || hurt.AttackerY == nil || hurt.AttackerZ == nil) {
						hurtPlayerBackedAttackerMissing++
					}
				}

				for _, bomb := range round.BombEvents {
					if bomb.X == nil || bomb.Y == nil || bomb.Z == nil {
						bombPositionMissing++
					}

					needsSite := bomb.Type == "plant_start" || bomb.Type == "planted" || bomb.Type == "defused" || bomb.Type == "exploded"
					forbidsSite := bomb.Type == "pickup" || bomb.Type == "drop" || bomb.Type == "defuse_start" || bomb.Type == "defuse_abort"
					if needsSite && bomb.Site == nil {
						bombSiteShapeViolations++
					}
					if forbidsSite && bomb.Site != nil {
						bombSiteShapeViolations++
					}
				}
			}

			if killVictimMissing != 0 {
				t.Fatalf("fixture has %d kills missing victim position", killVictimMissing)
			}
			if killPlayerBackedKillerMissing != 0 {
				t.Fatalf("fixture has %d player-backed kills missing killer position", killPlayerBackedKillerMissing)
			}
			if hurtVictimMissing != 0 {
				t.Fatalf("fixture has %d hurt events missing victim position", hurtVictimMissing)
			}
			if hurtPlayerBackedAttackerMissing != 0 {
				t.Fatalf("fixture has %d player-backed hurt events missing attacker position", hurtPlayerBackedAttackerMissing)
			}
			if bombPositionMissing != 0 {
				t.Fatalf("fixture has %d bomb events missing position", bombPositionMissing)
			}
			if bombSiteShapeViolations != 0 {
				t.Fatalf("fixture has %d bomb events with invalid site shape", bombSiteShapeViolations)
			}
		})
	}
}
