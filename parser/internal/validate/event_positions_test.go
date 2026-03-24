package validate

import (
	"strings"
	"testing"

	"mastermind/parser/internal/replay"
)

func TestValidateReplayRejectsIncompleteEventPositions(t *testing.T) {
	t.Run("kill missing victim position", func(t *testing.T) {
		data := replayWithEventFixtures()
		data.Rounds[0].KillEvents[0].VictimX = nil
		assertEventValidationErrorContains(t, ValidateReplay(data), "kill at tick 10 is missing victim position")
	})

	t.Run("kill missing killer position only when player-backed", func(t *testing.T) {
		data := replayWithEventFixtures()
		data.Rounds[0].KillEvents[0].KillerX = nil
		assertEventValidationErrorContains(t, ValidateReplay(data), "missing killer position for player-backed kill")
	})

	t.Run("world kill may omit killer position", func(t *testing.T) {
		data := replayWithEventFixtures()
		data.Rounds[0].KillEvents[1].KillerPlayerID = nil
		data.Rounds[0].KillEvents[1].KillerX = nil
		data.Rounds[0].KillEvents[1].KillerY = nil
		data.Rounds[0].KillEvents[1].KillerZ = nil
		if err := ValidateReplay(data); err != nil {
			t.Fatalf("expected world-backed kill position omission to remain valid, got %v", err)
		}
	})

	t.Run("hurt missing victim position", func(t *testing.T) {
		data := replayWithEventFixtures()
		data.Rounds[0].HurtEvents[0].VictimY = nil
		assertEventValidationErrorContains(t, ValidateReplay(data), "hurt event at tick 12 is missing victim position")
	})

	t.Run("hurt missing attacker position only when player-backed", func(t *testing.T) {
		data := replayWithEventFixtures()
		data.Rounds[0].HurtEvents[0].AttackerZ = nil
		assertEventValidationErrorContains(t, ValidateReplay(data), "missing attacker position for player-backed hurt")
	})

	t.Run("bomb missing position", func(t *testing.T) {
		data := replayWithEventFixtures()
		data.Rounds[0].BombEvents[0].X = nil
		assertEventValidationErrorContains(t, ValidateReplay(data), "bomb event planted at tick 20 is missing position")
	})

	t.Run("bomb site required for planted family", func(t *testing.T) {
		data := replayWithEventFixtures()
		data.Rounds[0].BombEvents[0].Site = nil
		assertEventValidationErrorContains(t, ValidateReplay(data), "bomb event planted at tick 20 is missing site")
	})

	t.Run("bomb site forbidden for pickup family", func(t *testing.T) {
		data := replayWithEventFixtures()
		data.Rounds[0].BombEvents[1].Site = replay.String("A")
		assertEventValidationErrorContains(t, ValidateReplay(data), "bomb event pickup at tick 21 should not carry a site")
	})
}

func replayWithEventFixtures() replay.Replay {
	return replay.Replay{
		Rounds: []replay.Round{
			{
				RoundNumber:   1,
				StartTick:     0,
				EndTick:       100,
				ScoreBefore:   replay.Score{},
				ScoreAfter:    replay.Score{},
				PlayerStreams: []replay.PlayerStream{},
				BlindEvents:   []replay.BlindEvent{},
				FireEvents:    []replay.FireEvent{},
				HurtEvents: []replay.HurtEvent{
					{
						Tick:              12,
						AttackerPlayerID:  replay.String("player:attacker"),
						VictimPlayerID:    replay.String("player:victim"),
						WeaponName:        "ak47",
						HealthDamageTaken: 30,
						ArmorDamageTaken:  0,
						AttackerX:         replay.Float64(1),
						AttackerY:         replay.Float64(2),
						AttackerZ:         replay.Float64(3),
						VictimX:           replay.Float64(4),
						VictimY:           replay.Float64(5),
						VictimZ:           replay.Float64(6),
					},
				},
				KillEvents: []replay.KillEvent{
					{
						Tick:           10,
						KillerPlayerID: replay.String("player:killer"),
						VictimPlayerID: "player:victim",
						WeaponName:     "ak47",
						KillerX:        replay.Float64(1),
						KillerY:        replay.Float64(2),
						KillerZ:        replay.Float64(3),
						VictimX:        replay.Float64(4),
						VictimY:        replay.Float64(5),
						VictimZ:        replay.Float64(6),
					},
					{
						Tick:           11,
						KillerPlayerID: replay.String("player:killer"),
						VictimPlayerID: "player:victim2",
						WeaponName:     "c4",
						KillerX:        replay.Float64(7),
						KillerY:        replay.Float64(8),
						KillerZ:        replay.Float64(9),
						VictimX:        replay.Float64(10),
						VictimY:        replay.Float64(11),
						VictimZ:        replay.Float64(12),
					},
				},
				BombEvents: []replay.BombEvent{
					{
						Tick:     20,
						Type:     "planted",
						PlayerID: replay.String("player:planter"),
						Site:     replay.String("A"),
						X:        replay.Float64(1),
						Y:        replay.Float64(2),
						Z:        replay.Float64(3),
					},
					{
						Tick:     21,
						Type:     "pickup",
						PlayerID: replay.String("player:carrier"),
						Site:     nil,
						X:        replay.Float64(4),
						Y:        replay.Float64(5),
						Z:        replay.Float64(6),
					},
				},
				UtilityEntities: []replay.UtilityEntity{},
			},
		},
	}
}

func assertEventValidationErrorContains(t *testing.T, err error, fragment string) {
	t.Helper()

	if err == nil {
		t.Fatalf("expected validation error containing %q, got nil", fragment)
	}
	if !strings.Contains(err.Error(), fragment) {
		t.Fatalf("expected validation error containing %q, got %v", fragment, err)
	}
}
