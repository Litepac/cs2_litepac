package validate_test

import (
	"math"
	"os"
	"path/filepath"
	"testing"

	"mastermind/parser/internal/replay"
)

func TestReplayFixturesYawInvariants(t *testing.T) {
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

			yawWhileDead := 0
			yawWithoutFullPosition := 0
			nonFiniteYaw := 0
			outOfRangeYaw := 0
			missingYawOnLivePosition := 0
			livePositionSamples := 0

			for _, round := range data.Rounds {
				for _, stream := range round.PlayerStreams {
					for index, yaw := range stream.Yaw {
						alive := stream.Alive[index]
						hasFullPosition := stream.X[index] != nil && stream.Y[index] != nil && stream.Z[index] != nil

						if alive && hasFullPosition {
							livePositionSamples++
							if yaw == nil {
								missingYawOnLivePosition++
							}
						}

						if yaw == nil {
							continue
						}

						if !alive {
							yawWhileDead++
						}
						if !hasFullPosition {
							yawWithoutFullPosition++
						}
						if math.IsNaN(*yaw) || math.IsInf(*yaw, 0) {
							nonFiniteYaw++
						}
						if *yaw < -180 || *yaw > 180 {
							outOfRangeYaw++
						}
					}
				}
			}

			if livePositionSamples == 0 {
				t.Fatalf("fixture has no live-position samples")
			}
			if yawWhileDead != 0 {
				t.Fatalf("fixture has %d yaw samples while dead", yawWhileDead)
			}
			if yawWithoutFullPosition != 0 {
				t.Fatalf("fixture has %d yaw samples without full position", yawWithoutFullPosition)
			}
			if nonFiniteYaw != 0 {
				t.Fatalf("fixture has %d non-finite yaw samples", nonFiniteYaw)
			}
			if outOfRangeYaw != 0 {
				t.Fatalf("fixture has %d out-of-range yaw samples", outOfRangeYaw)
			}

			// Current local goldens have full live-position yaw coverage; keep that as a regression tripwire for these fixtures.
			if missingYawOnLivePosition != 0 {
				t.Fatalf(
					"fixture has %d missing yaw samples on live positioned players (current goldens expect 0/%d)",
					missingYawOnLivePosition,
					livePositionSamples,
				)
			}
		})
	}
}
