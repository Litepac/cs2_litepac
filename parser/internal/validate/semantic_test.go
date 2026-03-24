package validate

import (
	"math"
	"strings"
	"testing"

	"mastermind/parser/internal/replay"
)

func TestValidateReplayRejectsImpossibleYawStates(t *testing.T) {
	t.Run("yaw while dead", func(t *testing.T) {
		err := ValidateReplay(replayWithYawSample(func(stream *replay.PlayerStream) {
			stream.Alive[0] = false
		}))
		assertValidationErrorContains(t, err, "has yaw while not alive")
	})

	t.Run("yaw without full position", func(t *testing.T) {
		err := ValidateReplay(replayWithYawSample(func(stream *replay.PlayerStream) {
			stream.X[0] = nil
		}))
		assertValidationErrorContains(t, err, "has yaw without full position")
	})

	t.Run("non-finite yaw", func(t *testing.T) {
		err := ValidateReplay(replayWithYawSample(func(stream *replay.PlayerStream) {
			stream.Yaw[0] = replay.Float64(math.Inf(1))
		}))
		assertValidationErrorContains(t, err, "has non-finite yaw")
	})

	t.Run("out of range yaw", func(t *testing.T) {
		err := ValidateReplay(replayWithYawSample(func(stream *replay.PlayerStream) {
			stream.Yaw[0] = replay.Float64(181)
		}))
		assertValidationErrorContains(t, err, "has out-of-range yaw")
	})

	t.Run("nil yaw remains valid", func(t *testing.T) {
		err := ValidateReplay(replayWithYawSample(func(stream *replay.PlayerStream) {
			stream.Yaw[0] = nil
		}))
		if err != nil {
			t.Fatalf("expected nil yaw to remain valid, got %v", err)
		}
	})
}

func TestValidateReplayAcceptsPlayerStreamsThroughOfficialEnd(t *testing.T) {
	data := replayWithYawSample(func(stream *replay.PlayerStream) {
		stream.X = append(stream.X, replay.Float64(11), replay.Float64(12))
		stream.Y = append(stream.Y, replay.Float64(21), replay.Float64(22))
		stream.Z = append(stream.Z, replay.Float64(31), replay.Float64(32))
		stream.Yaw = append(stream.Yaw, replay.Float64(90), replay.Float64(90))
		stream.Alive = append(stream.Alive, true, true)
		stream.HasBomb = append(stream.HasBomb, false, false)
		stream.Health = append(stream.Health, replay.Int(100), replay.Int(100))
		stream.Armor = append(stream.Armor, replay.Int(0), replay.Int(0))
		stream.HasHelmet = append(stream.HasHelmet, false, false)
		stream.Money = append(stream.Money, replay.Int(800), replay.Int(800))
		stream.ActiveWeapon = append(stream.ActiveWeapon, nil, nil)
		stream.ActiveWeaponClass = append(stream.ActiveWeaponClass, nil, nil)
		stream.MainWeapon = append(stream.MainWeapon, nil, nil)
		stream.Flashbangs = append(stream.Flashbangs, nil, nil)
		stream.Smokes = append(stream.Smokes, nil, nil)
		stream.HEGrenades = append(stream.HEGrenades, nil, nil)
		stream.FireGrenades = append(stream.FireGrenades, nil, nil)
		stream.Decoys = append(stream.Decoys, nil, nil)
	})
	data.Rounds[0].EndTick = 0
	data.Rounds[0].OfficialEndTick = replay.Int(2)

	if err := ValidateReplay(data); err != nil {
		t.Fatalf("expected player stream through official end to remain valid, got %v", err)
	}
}

func TestValidateReplayRejectsInvalidStreamBounds(t *testing.T) {
	t.Run("official end before end tick", func(t *testing.T) {
		data := replayWithYawSample(func(stream *replay.PlayerStream) {
			_ = stream
		})
		data.Rounds[0].EndTick = 10
		data.Rounds[0].OfficialEndTick = replay.Int(9)
		assertValidationErrorContains(t, ValidateReplay(data), "official end tick 9 is before end tick 10")
	})

	t.Run("non-positive sample interval", func(t *testing.T) {
		data := replayWithYawSample(func(stream *replay.PlayerStream) {
			stream.SampleIntervalTicks = 0
		})
		assertValidationErrorContains(t, ValidateReplay(data), "has non-positive sample interval")
	})

	t.Run("stream starts after effective round end", func(t *testing.T) {
		data := replayWithYawSample(func(stream *replay.PlayerStream) {
			stream.SampleOriginTick = 2
		})
		assertValidationErrorContains(t, ValidateReplay(data), "starts at tick 2 outside round bounds")
	})

	t.Run("stream extends beyond effective round end", func(t *testing.T) {
		data := replayWithYawSample(func(stream *replay.PlayerStream) {
			stream.X = append(stream.X, replay.Float64(11))
			stream.Y = append(stream.Y, replay.Float64(21))
			stream.Z = append(stream.Z, replay.Float64(31))
			stream.Yaw = append(stream.Yaw, replay.Float64(90))
			stream.Alive = append(stream.Alive, true)
			stream.HasBomb = append(stream.HasBomb, false)
			stream.Health = append(stream.Health, replay.Int(100))
			stream.Armor = append(stream.Armor, replay.Int(0))
			stream.HasHelmet = append(stream.HasHelmet, false)
			stream.Money = append(stream.Money, replay.Int(800))
			stream.ActiveWeapon = append(stream.ActiveWeapon, nil)
			stream.ActiveWeaponClass = append(stream.ActiveWeaponClass, nil)
			stream.MainWeapon = append(stream.MainWeapon, nil)
			stream.Flashbangs = append(stream.Flashbangs, nil)
			stream.Smokes = append(stream.Smokes, nil)
			stream.HEGrenades = append(stream.HEGrenades, nil)
			stream.FireGrenades = append(stream.FireGrenades, nil)
			stream.Decoys = append(stream.Decoys, nil)
		})
		assertValidationErrorContains(t, ValidateReplay(data), "ends at tick 1 after effective round end 0")
	})
}

func replayWithYawSample(mutator func(stream *replay.PlayerStream)) replay.Replay {
	stream := replay.PlayerStream{
		PlayerID:            "player:test",
		Side:                replay.String("CT"),
		SampleOriginTick:    0,
		SampleIntervalTicks: 1,
		X:                   []*float64{replay.Float64(10)},
		Y:                   []*float64{replay.Float64(20)},
		Z:                   []*float64{replay.Float64(30)},
		Yaw:                 []*float64{replay.Float64(90)},
		Alive:               []bool{true},
		HasBomb:             []bool{false},
		Health:              []*int{replay.Int(100)},
		Armor:               []*int{replay.Int(0)},
		HasHelmet:           []bool{false},
		Money:               []*int{replay.Int(800)},
		ActiveWeapon:        []*string{nil},
		ActiveWeaponClass:   []*string{nil},
		MainWeapon:          []*string{nil},
		Flashbangs:          []*int{nil},
		Smokes:              []*int{nil},
		HEGrenades:          []*int{nil},
		FireGrenades:        []*int{nil},
		Decoys:              []*int{nil},
	}
	mutator(&stream)

	return replay.Replay{
		Rounds: []replay.Round{
			{
				RoundNumber:     1,
				StartTick:       0,
				FreezeEndTick:   nil,
				EndTick:         0,
				OfficialEndTick: nil,
				ScoreBefore:     replay.Score{},
				ScoreAfter:      replay.Score{},
				WinnerSide:      nil,
				EndReason:       nil,
				PlayerStreams:   []replay.PlayerStream{stream},
				BlindEvents:     []replay.BlindEvent{},
				FireEvents:      []replay.FireEvent{},
				HurtEvents:      []replay.HurtEvent{},
				KillEvents:      []replay.KillEvent{},
				BombEvents:      []replay.BombEvent{},
				UtilityEntities: []replay.UtilityEntity{},
			},
		},
	}
}

func assertValidationErrorContains(t *testing.T, err error, fragment string) {
	t.Helper()

	if err == nil {
		t.Fatalf("expected validation error containing %q, got nil", fragment)
	}
	if !strings.Contains(err.Error(), fragment) {
		t.Fatalf("expected validation error containing %q, got %v", fragment, err)
	}
}
