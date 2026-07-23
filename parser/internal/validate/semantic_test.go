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

func TestValidateReplayRejectsImpossibleViewStates(t *testing.T) {
	t.Run("pitch while dead", func(t *testing.T) {
		err := ValidateReplay(replayWithYawSample(func(stream *replay.PlayerStream) {
			stream.Alive[0] = false
			stream.Yaw[0] = nil
			stream.EyeX[0] = nil
			stream.EyeY[0] = nil
			stream.EyeZ[0] = nil
		}))
		assertValidationErrorContains(t, err, "has pitch while not alive")
	})

	t.Run("non-finite pitch", func(t *testing.T) {
		err := ValidateReplay(replayWithYawSample(func(stream *replay.PlayerStream) {
			stream.Pitch[0] = replay.Float64(math.Inf(1))
		}))
		assertValidationErrorContains(t, err, "has non-finite pitch")
	})

	t.Run("out of range pitch", func(t *testing.T) {
		err := ValidateReplay(replayWithYawSample(func(stream *replay.PlayerStream) {
			stream.Pitch[0] = replay.Float64(91)
		}))
		assertValidationErrorContains(t, err, "has out-of-range pitch")
	})

	t.Run("partial eye position", func(t *testing.T) {
		err := ValidateReplay(replayWithYawSample(func(stream *replay.PlayerStream) {
			stream.EyeZ[0] = nil
		}))
		assertValidationErrorContains(t, err, "has partial eye position")
	})

	t.Run("eye position without full position", func(t *testing.T) {
		err := ValidateReplay(replayWithYawSample(func(stream *replay.PlayerStream) {
			stream.X[0] = nil
			stream.Yaw[0] = nil
			stream.Pitch[0] = nil
		}))
		assertValidationErrorContains(t, err, "has eye position without full position")
	})
}

func TestValidateReplayRejectsInvalidPovState(t *testing.T) {
	t.Run("scoped while dead", func(t *testing.T) {
		err := ValidateReplay(replayWithYawSample(func(stream *replay.PlayerStream) {
			stream.Alive[0] = false
			stream.Yaw[0] = nil
			stream.Pitch[0] = nil
			stream.EyeX[0] = nil
			stream.EyeY[0] = nil
			stream.EyeZ[0] = nil
			stream.IsScoped[0] = replay.Bool(true)
			stream.ViewmodelFOV[0] = nil
			stream.ViewmodelOffsetX[0] = nil
			stream.ViewmodelOffsetY[0] = nil
			stream.ViewmodelOffsetZ[0] = nil
		}))
		assertValidationErrorContains(t, err, "has scoped state while not alive")
	})

	t.Run("partial viewmodel offset", func(t *testing.T) {
		err := ValidateReplay(replayWithYawSample(func(stream *replay.PlayerStream) {
			stream.ViewmodelOffsetZ[0] = nil
		}))
		assertValidationErrorContains(t, err, "has partial viewmodel offset")
	})

	t.Run("invalid recoil index", func(t *testing.T) {
		err := ValidateReplay(replayWithYawSample(func(stream *replay.PlayerStream) {
			stream.RecoilIndex[0] = replay.Float64(math.Inf(1))
		}))
		assertValidationErrorContains(t, err, "has invalid recoil index")
	})

	t.Run("unknown movement state remains valid", func(t *testing.T) {
		err := ValidateReplay(replayWithYawSample(func(stream *replay.PlayerStream) {
			stream.IsWalking[0] = nil
			stream.IsDucking[0] = nil
			stream.IsOnGround[0] = nil
		}))
		if err != nil {
			t.Fatalf("expected unknown movement state to remain valid, got %v", err)
		}
	})
}

func TestValidateReplayRejectsInvalidRoundTruth(t *testing.T) {
	t.Run("non-sequential round number", func(t *testing.T) {
		data := replayWithYawSample(func(stream *replay.PlayerStream) {
			_ = stream
		})
		data.Rounds[0].RoundNumber = 2
		assertValidationErrorContains(t, ValidateReplay(data), "has number 2, expected 1")
	})

	t.Run("score advances twice", func(t *testing.T) {
		data := replayWithYawSample(func(stream *replay.PlayerStream) {
			_ = stream
		})
		data.Rounds[0].ScoreAfter.T = 2
		assertValidationErrorContains(t, ValidateReplay(data), "score advances by more than one point")
	})

	t.Run("winner does not match score", func(t *testing.T) {
		data := replayWithYawSample(func(stream *replay.PlayerStream) {
			_ = stream
		})
		data.Rounds[0].WinnerSide = replay.String("CT")
		data.Rounds[0].ScoreAfter.T = 1
		assertValidationErrorContains(t, ValidateReplay(data), "winner side does not match score advance")
	})

	t.Run("score is discontinuous between rounds", func(t *testing.T) {
		data := replayWithYawSample(func(stream *replay.PlayerStream) {
			_ = stream
		})
		data.Rounds[0].ScoreAfter.T = 1
		data.Rounds = append(data.Rounds, replay.Round{
			RoundNumber:     2,
			StartTick:       1,
			EndTick:         1,
			ScoreBefore:     replay.Score{},
			ScoreAfter:      replay.Score{},
			PlayerStreams:   []replay.PlayerStream{},
			BlindEvents:     []replay.BlindEvent{},
			FireEvents:      []replay.FireEvent{},
			HurtEvents:      []replay.HurtEvent{},
			KillEvents:      []replay.KillEvent{},
			BombEvents:      []replay.BombEvent{},
			UtilityEntities: []replay.UtilityEntity{},
		})
		assertValidationErrorContains(t, ValidateReplay(data), "score before does not match previous score after")
	})
}

func TestSameOrSwappedScoreAllowsHalftimeSideSwap(t *testing.T) {
	if !sameOrSwappedScore(replay.Score{T: 7, CT: 5}, replay.Score{T: 5, CT: 7}) {
		t.Fatal("expected halftime side swap to preserve score continuity")
	}
	if sameOrSwappedScore(replay.Score{T: 8, CT: 5}, replay.Score{T: 5, CT: 7}) {
		t.Fatal("expected an unrelated score transition to remain invalid")
	}
}

func TestValidateReplayAcceptsPlayerStreamsThroughOfficialEnd(t *testing.T) {
	data := replayWithYawSample(func(stream *replay.PlayerStream) {
		stream.X = append(stream.X, replay.Float64(11), replay.Float64(12))
		stream.Y = append(stream.Y, replay.Float64(21), replay.Float64(22))
		stream.Z = append(stream.Z, replay.Float64(31), replay.Float64(32))
		stream.Yaw = append(stream.Yaw, replay.Float64(90), replay.Float64(90))
		stream.Pitch = append(stream.Pitch, replay.Float64(0), replay.Float64(0))
		stream.EyeX = append(stream.EyeX, replay.Float64(11), replay.Float64(12))
		stream.EyeY = append(stream.EyeY, replay.Float64(21), replay.Float64(22))
		stream.EyeZ = append(stream.EyeZ, replay.Float64(95), replay.Float64(96))
		stream.IsScoped = append(stream.IsScoped, replay.Bool(false), replay.Bool(false))
		stream.ZoomLevel = append(stream.ZoomLevel, nil, nil)
		stream.ViewmodelFOV = append(stream.ViewmodelFOV, replay.Float64(68), replay.Float64(68))
		stream.ViewmodelOffsetX = append(stream.ViewmodelOffsetX, replay.Float64(2.5), replay.Float64(2.5))
		stream.ViewmodelOffsetY = append(stream.ViewmodelOffsetY, replay.Float64(0), replay.Float64(0))
		stream.ViewmodelOffsetZ = append(stream.ViewmodelOffsetZ, replay.Float64(-1.5), replay.Float64(-1.5))
		stream.RecoilIndex = append(stream.RecoilIndex, replay.Float64(0), replay.Float64(0))
		stream.IsWalking = append(stream.IsWalking, replay.Bool(false), replay.Bool(false))
		stream.IsDucking = append(stream.IsDucking, replay.Bool(false), replay.Bool(false))
		stream.IsOnGround = append(stream.IsOnGround, replay.Bool(true), replay.Bool(true))
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
			stream.Pitch = append(stream.Pitch, replay.Float64(0))
			stream.EyeX = append(stream.EyeX, replay.Float64(11))
			stream.EyeY = append(stream.EyeY, replay.Float64(21))
			stream.EyeZ = append(stream.EyeZ, replay.Float64(95))
			stream.IsScoped = append(stream.IsScoped, replay.Bool(false))
			stream.ZoomLevel = append(stream.ZoomLevel, nil)
			stream.ViewmodelFOV = append(stream.ViewmodelFOV, replay.Float64(68))
			stream.ViewmodelOffsetX = append(stream.ViewmodelOffsetX, replay.Float64(2.5))
			stream.ViewmodelOffsetY = append(stream.ViewmodelOffsetY, replay.Float64(0))
			stream.ViewmodelOffsetZ = append(stream.ViewmodelOffsetZ, replay.Float64(-1.5))
			stream.RecoilIndex = append(stream.RecoilIndex, replay.Float64(0))
			stream.IsWalking = append(stream.IsWalking, replay.Bool(false))
			stream.IsDucking = append(stream.IsDucking, replay.Bool(false))
			stream.IsOnGround = append(stream.IsOnGround, replay.Bool(true))
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

func TestValidateReplayRejectsInvalidUtilityTruth(t *testing.T) {
	t.Run("end before start", func(t *testing.T) {
		data := replayWithUtilityEntity(replay.UtilityEntity{
			UtilityID: "utility:flash",
			Kind:      "flashbang",
			StartTick: 2,
			EndTick:   replay.Int(1),
			Trajectory: replay.Trajectory{
				SampleOriginTick:    2,
				SampleIntervalTicks: 1,
				X:                   []*float64{replay.Float64(1)},
				Y:                   []*float64{replay.Float64(2)},
				Z:                   []*float64{replay.Float64(3)},
			},
			PhaseEvents: []replay.UtilityPhaseEvent{{Tick: 0, Type: "thrown"}},
		})

		assertValidationErrorContains(t, ValidateReplay(data), "ends before it starts")
	})

	t.Run("trajectory non-finite position", func(t *testing.T) {
		data := replayWithUtilityEntity(replay.UtilityEntity{
			UtilityID: "utility:he",
			Kind:      "he",
			StartTick: 0,
			Trajectory: replay.Trajectory{
				SampleOriginTick:    0,
				SampleIntervalTicks: 1,
				X:                   []*float64{replay.Float64(math.NaN())},
				Y:                   []*float64{replay.Float64(2)},
				Z:                   []*float64{replay.Float64(3)},
			},
			PhaseEvents: []replay.UtilityPhaseEvent{{Tick: 0, Type: "thrown"}},
		})

		assertValidationErrorContains(t, ValidateReplay(data), "trajectory has non-finite position")
	})

	t.Run("trajectory extends after round end", func(t *testing.T) {
		data := replayWithUtilityEntity(replay.UtilityEntity{
			UtilityID: "utility:he",
			Kind:      "he",
			StartTick: 4,
			Trajectory: replay.Trajectory{
				SampleOriginTick:    4,
				SampleIntervalTicks: 1,
				X:                   []*float64{replay.Float64(1), replay.Float64(2)},
				Y:                   []*float64{replay.Float64(1), replay.Float64(2)},
				Z:                   []*float64{replay.Float64(1), replay.Float64(2)},
			},
			PhaseEvents: []replay.UtilityPhaseEvent{{Tick: 4, Type: "thrown"}},
		})

		assertValidationErrorContains(t, ValidateReplay(data), "trajectory ends after round end")
	})

	t.Run("phase occurs after round end", func(t *testing.T) {
		data := replayWithUtilityEntity(replay.UtilityEntity{
			UtilityID: "utility:flash",
			Kind:      "flashbang",
			StartTick: 0,
			Trajectory: replay.Trajectory{
				SampleOriginTick:    0,
				SampleIntervalTicks: 1,
				X:                   []*float64{replay.Float64(1)},
				Y:                   []*float64{replay.Float64(2)},
				Z:                   []*float64{replay.Float64(3)},
			},
			PhaseEvents: []replay.UtilityPhaseEvent{{Tick: 5, Type: "detonate"}},
		})

		assertValidationErrorContains(t, ValidateReplay(data), "phase detonate at tick 5 is after round end")
	})

	t.Run("unsorted phase events", func(t *testing.T) {
		data := replayWithUtilityEntity(replay.UtilityEntity{
			UtilityID: "utility:smoke",
			Kind:      "smoke",
			StartTick: 0,
			Trajectory: replay.Trajectory{
				SampleOriginTick:    0,
				SampleIntervalTicks: 1,
				X:                   []*float64{replay.Float64(1)},
				Y:                   []*float64{replay.Float64(2)},
				Z:                   []*float64{replay.Float64(3)},
			},
			PhaseEvents: []replay.UtilityPhaseEvent{
				{Tick: 2, Type: "expired"},
				{Tick: 1, Type: "detonated"},
			},
		})

		assertValidationErrorContains(t, ValidateReplay(data), "phase events are not sorted")
	})

	t.Run("non-fire footprint", func(t *testing.T) {
		data := replayWithUtilityEntity(replay.UtilityEntity{
			UtilityID: "utility:smoke",
			Kind:      "smoke",
			StartTick: 0,
			Trajectory: replay.Trajectory{
				SampleOriginTick:    0,
				SampleIntervalTicks: 1,
				X:                   []*float64{replay.Float64(1)},
				Y:                   []*float64{replay.Float64(2)},
				Z:                   []*float64{replay.Float64(3)},
			},
			PhaseEvents: []replay.UtilityPhaseEvent{{Tick: 0, Type: "thrown"}},
			FireFootprint: []replay.FireFootprintSample{
				{
					Tick: 0,
					X:    []*float64{replay.Float64(10)},
					Y:    []*float64{replay.Float64(20)},
					Z:    []*float64{replay.Float64(30)},
				},
			},
		})

		assertValidationErrorContains(t, ValidateReplay(data), "has fire footprint for non-fire utility")
	})

	t.Run("fire footprint cell arrays differ", func(t *testing.T) {
		data := replayWithUtilityEntity(replay.UtilityEntity{
			UtilityID: "utility:molotov",
			Kind:      "molotov",
			StartTick: 0,
			Trajectory: replay.Trajectory{
				SampleOriginTick:    0,
				SampleIntervalTicks: 1,
				X:                   []*float64{replay.Float64(1)},
				Y:                   []*float64{replay.Float64(2)},
				Z:                   []*float64{replay.Float64(3)},
			},
			PhaseEvents: []replay.UtilityPhaseEvent{{Tick: 0, Type: "thrown"}},
			FireFootprint: []replay.FireFootprintSample{
				{
					Tick: 0,
					X:    []*float64{replay.Float64(10)},
					Y:    []*float64{},
					Z:    []*float64{replay.Float64(30)},
				},
			},
		})

		assertValidationErrorContains(t, ValidateReplay(data), "fire footprint sample at tick 0 array lengths differ")
	})

	t.Run("displaced phase on non-smoke", func(t *testing.T) {
		data := replayWithUtilityEntity(replay.UtilityEntity{
			UtilityID: "utility:molotov",
			Kind:      "molotov",
			StartTick: 0,
			Trajectory: replay.Trajectory{
				SampleOriginTick:    0,
				SampleIntervalTicks: 1,
				X:                   []*float64{replay.Float64(1)},
				Y:                   []*float64{replay.Float64(2)},
				Z:                   []*float64{replay.Float64(3)},
			},
			PhaseEvents: []replay.UtilityPhaseEvent{
				{
					Tick:          0,
					Type:          "displaced",
					DurationTicks: replay.Int(10),
					X:             replay.Float64(10),
					Y:             replay.Float64(20),
					Z:             replay.Float64(30),
				},
			},
		})

		assertValidationErrorContains(t, ValidateReplay(data), "has displaced phase for non-smoke utility")
	})

	t.Run("displaced phase missing position", func(t *testing.T) {
		data := replayWithUtilityEntity(replay.UtilityEntity{
			UtilityID: "utility:smoke",
			Kind:      "smoke",
			StartTick: 0,
			Trajectory: replay.Trajectory{
				SampleOriginTick:    0,
				SampleIntervalTicks: 1,
				X:                   []*float64{replay.Float64(1)},
				Y:                   []*float64{replay.Float64(2)},
				Z:                   []*float64{replay.Float64(3)},
			},
			PhaseEvents: []replay.UtilityPhaseEvent{
				{
					Tick:          0,
					Type:          "displaced",
					DurationTicks: replay.Int(10),
					X:             replay.Float64(10),
					Y:             nil,
					Z:             replay.Float64(30),
				},
			},
		})

		assertValidationErrorContains(t, ValidateReplay(data), "displaced phase at tick 0 is missing position")
	})
}

func TestValidateReplayRejectsInvalidBombTruth(t *testing.T) {
	t.Run("unsorted bomb events", func(t *testing.T) {
		data := replayWithYawSample(func(stream *replay.PlayerStream) {
			_ = stream
		})
		data.Rounds[0].EndTick = 4
		data.Rounds[0].BombEvents = []replay.BombEvent{
			bombEvent(2, "drop", nil),
			bombEvent(1, "pickup", nil),
		}

		assertValidationErrorContains(t, ValidateReplay(data), "bomb events are not sorted")
	})

	t.Run("terminal bomb event before plant", func(t *testing.T) {
		data := replayWithYawSample(func(stream *replay.PlayerStream) {
			_ = stream
		})
		data.Rounds[0].EndTick = 4
		site := "A"
		data.Rounds[0].BombEvents = []replay.BombEvent{
			bombEvent(2, "exploded", &site),
		}

		assertValidationErrorContains(t, ValidateReplay(data), "occurs before planted")
	})

	t.Run("event after terminal bomb event", func(t *testing.T) {
		data := replayWithYawSample(func(stream *replay.PlayerStream) {
			_ = stream
		})
		data.Rounds[0].EndTick = 4
		site := "A"
		data.Rounds[0].BombEvents = []replay.BombEvent{
			bombEvent(1, "planted", &site),
			bombEvent(2, "defused", &site),
			bombEvent(3, "exploded", &site),
		}

		assertValidationErrorContains(t, ValidateReplay(data), "occurs after terminal bomb event")
	})

	t.Run("defuse abort without active defuse", func(t *testing.T) {
		data := replayWithYawSample(func(stream *replay.PlayerStream) {
			_ = stream
		})
		data.Rounds[0].EndTick = 4
		site := "B"
		data.Rounds[0].BombEvents = []replay.BombEvent{
			bombEvent(1, "planted", &site),
			bombEvent(2, "defuse_abort", nil),
		}

		assertValidationErrorContains(t, ValidateReplay(data), "has no active defuse")
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
		Pitch:               []*float64{replay.Float64(0)},
		EyeX:                []*float64{replay.Float64(10)},
		EyeY:                []*float64{replay.Float64(20)},
		EyeZ:                []*float64{replay.Float64(94)},
		IsScoped:            []*bool{replay.Bool(false)},
		ZoomLevel:           []*int{nil},
		ViewmodelFOV:        []*float64{replay.Float64(68)},
		ViewmodelOffsetX:    []*float64{replay.Float64(2.5)},
		ViewmodelOffsetY:    []*float64{replay.Float64(0)},
		ViewmodelOffsetZ:    []*float64{replay.Float64(-1.5)},
		RecoilIndex:         []*float64{replay.Float64(0)},
		IsWalking:           []*bool{replay.Bool(false)},
		IsDucking:           []*bool{replay.Bool(false)},
		IsOnGround:          []*bool{replay.Bool(true)},
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

func replayWithUtilityEntity(utility replay.UtilityEntity) replay.Replay {
	data := replayWithYawSample(func(stream *replay.PlayerStream) {
		_ = stream
	})
	data.Rounds[0].EndTick = 4
	data.Rounds[0].UtilityEntities = []replay.UtilityEntity{utility}
	return data
}

func bombEvent(tick int, eventType string, site *string) replay.BombEvent {
	return replay.BombEvent{
		Tick: tick,
		Type: eventType,
		Site: site,
		X:    replay.Float64(1),
		Y:    replay.Float64(2),
		Z:    replay.Float64(3),
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
