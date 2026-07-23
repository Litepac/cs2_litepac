package validate

import (
	"encoding/json"
	"math"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"mastermind/parser/internal/replay"
)

func TestValidateSchemaAcceptsCommittedSmokeReplay(t *testing.T) {
	data, schemaPath := loadSchemaTestReplay(t)

	if err := ValidateSchema(schemaPath, data); err != nil {
		t.Fatalf("validate committed smoke replay: %v", err)
	}
}

func TestValidateSchemaReportsStagedPlayerStreamPath(t *testing.T) {
	data, schemaPath := loadSchemaTestReplay(t)
	data.Rounds[0].PlayerStreams[0].ActiveWeaponClass[0] = replay.String("laser")

	err := ValidateSchema(schemaPath, data)
	assertSchemaErrorContains(t, err, "rounds[0].playerStreams[0]")
	assertSchemaErrorContains(t, err, "not an allowed weapon class")
}

func TestValidateSchemaRejectsNullAndNonFiniteStreamArraysWithoutMaterializingThem(t *testing.T) {
	t.Run("null required array", func(t *testing.T) {
		data, schemaPath := loadSchemaTestReplay(t)
		data.Rounds[0].PlayerStreams[0].Pitch = nil

		err := ValidateSchema(schemaPath, data)
		assertSchemaErrorContains(t, err, "rounds[0].playerStreams[0].pitch")
		assertSchemaErrorContains(t, err, "got null")
	})

	t.Run("non-finite number", func(t *testing.T) {
		data, schemaPath := loadSchemaTestReplay(t)
		data.Rounds[0].PlayerStreams[0].Pitch[0] = replay.Float64(math.NaN())

		err := ValidateSchema(schemaPath, data)
		assertSchemaErrorContains(t, err, "rounds[0].playerStreams[0].pitch[0]")
		assertSchemaErrorContains(t, err, "finite JSON number")
	})
}

func TestValidateSchemaReportsStagedEventPath(t *testing.T) {
	data, schemaPath := loadSchemaTestReplay(t)
	data.Rounds[0].KillEvents = append(data.Rounds[0].KillEvents, replay.KillEvent{
		Tick:           -1,
		VictimPlayerID: "steam:1",
		WeaponName:     "weapon_glock",
	})

	err := ValidateSchema(schemaPath, data)
	assertSchemaErrorContains(t, err, "rounds[0].killEvents[0]")
	assertSchemaErrorContains(t, err, "minimum")
}

func TestValidateSchemaReportsStagedUtilityPath(t *testing.T) {
	data, schemaPath := loadSchemaTestReplay(t)
	data.Rounds[0].UtilityEntities = append(data.Rounds[0].UtilityEntities, replay.UtilityEntity{
		UtilityID: "utility:test",
		Kind:      "teleporter",
		Trajectory: replay.Trajectory{
			SampleIntervalTicks: 1,
			X:                   []*float64{},
			Y:                   []*float64{},
			Z:                   []*float64{},
		},
		PhaseEvents: []replay.UtilityPhaseEvent{},
	})

	err := ValidateSchema(schemaPath, data)
	assertSchemaErrorContains(t, err, "rounds[0].utilityEntities[0]")
	assertSchemaErrorContains(t, err, "must be one of")
}

func loadSchemaTestReplay(t *testing.T) (replay.Replay, string) {
	t.Helper()

	repoRoot := filepath.Join("..", "..", "..")
	replayPath := filepath.Join(repoRoot, "testdata", "goldens", "ci-smoke.replay.json")
	raw, err := os.ReadFile(replayPath)
	if err != nil {
		t.Fatalf("read schema test replay: %v", err)
	}

	var data replay.Replay
	if err := json.Unmarshal(raw, &data); err != nil {
		t.Fatalf("decode schema test replay: %v", err)
	}

	return data, filepath.Join(repoRoot, "schema", "mastermind.replay.schema.json")
}

func assertSchemaErrorContains(t *testing.T, err error, fragment string) {
	t.Helper()
	if err == nil {
		t.Fatalf("expected schema validation error containing %q, got nil", fragment)
	}
	if !strings.Contains(err.Error(), fragment) {
		t.Fatalf("expected schema validation error containing %q, got %v", fragment, err)
	}
}
