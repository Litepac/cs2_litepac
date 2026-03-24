package validate

import (
	"fmt"
	"math"

	"mastermind/parser/internal/replay"
)

func ValidateReplay(data replay.Replay) error {
	lastRoundEnd := -1
	for _, round := range data.Rounds {
		if round.EndTick < round.StartTick {
			return fmt.Errorf("round %d ends before it starts", round.RoundNumber)
		}

		effectiveEndTick := effectiveRoundEndTick(round)
		if round.OfficialEndTick != nil && *round.OfficialEndTick < round.EndTick {
			return fmt.Errorf("round %d official end tick %d is before end tick %d", round.RoundNumber, *round.OfficialEndTick, round.EndTick)
		}

		if lastRoundEnd >= 0 && round.StartTick <= lastRoundEnd {
			return fmt.Errorf("round %d overlaps the previous round", round.RoundNumber)
		}

		if round.ScoreAfter.T < round.ScoreBefore.T || round.ScoreAfter.CT < round.ScoreBefore.CT {
			return fmt.Errorf("round %d score regresses", round.RoundNumber)
		}

		for _, kill := range round.KillEvents {
			if kill.Tick < round.StartTick || kill.Tick > round.EndTick {
				return fmt.Errorf("round %d kill at tick %d is outside round bounds", round.RoundNumber, kill.Tick)
			}

			if kill.VictimX == nil || kill.VictimY == nil || kill.VictimZ == nil {
				return fmt.Errorf("round %d kill at tick %d is missing victim position", round.RoundNumber, kill.Tick)
			}

			if kill.KillerPlayerID != nil && (kill.KillerX == nil || kill.KillerY == nil || kill.KillerZ == nil) {
				return fmt.Errorf("round %d kill at tick %d is missing killer position for player-backed kill", round.RoundNumber, kill.Tick)
			}
		}

		for _, fire := range round.FireEvents {
			if fire.Tick < round.StartTick || fire.Tick > effectiveEndTick {
				return fmt.Errorf("round %d fire event at tick %d is outside round bounds", round.RoundNumber, fire.Tick)
			}
		}

		for _, blind := range round.BlindEvents {
			if blind.Tick < round.StartTick || blind.Tick > effectiveEndTick {
				return fmt.Errorf("round %d blind event at tick %d is outside round bounds", round.RoundNumber, blind.Tick)
			}

			if blind.DurationTicks <= 0 {
				return fmt.Errorf("round %d blind event at tick %d has non-positive duration", round.RoundNumber, blind.Tick)
			}

			if blind.EndTick <= blind.Tick {
				return fmt.Errorf("round %d blind event at tick %d ends before it starts", round.RoundNumber, blind.Tick)
			}
		}

		for _, hurt := range round.HurtEvents {
			if hurt.Tick < round.StartTick || hurt.Tick > effectiveEndTick {
				return fmt.Errorf("round %d hurt event at tick %d is outside round bounds", round.RoundNumber, hurt.Tick)
			}

			if hurt.VictimX == nil || hurt.VictimY == nil || hurt.VictimZ == nil {
				return fmt.Errorf("round %d hurt event at tick %d is missing victim position", round.RoundNumber, hurt.Tick)
			}

			if hurt.AttackerPlayerID != nil && (hurt.AttackerX == nil || hurt.AttackerY == nil || hurt.AttackerZ == nil) {
				return fmt.Errorf("round %d hurt event at tick %d is missing attacker position for player-backed hurt", round.RoundNumber, hurt.Tick)
			}
		}

		for _, bomb := range round.BombEvents {
			if bomb.Tick < round.StartTick || bomb.Tick > round.EndTick {
				return fmt.Errorf("round %d bomb event at tick %d is outside round bounds", round.RoundNumber, bomb.Tick)
			}

			if bomb.X == nil || bomb.Y == nil || bomb.Z == nil {
				return fmt.Errorf("round %d bomb event %s at tick %d is missing position", round.RoundNumber, bomb.Type, bomb.Tick)
			}

			switch bomb.Type {
			case "plant_start", "planted", "defused", "exploded":
				if bomb.Site == nil {
					return fmt.Errorf("round %d bomb event %s at tick %d is missing site", round.RoundNumber, bomb.Type, bomb.Tick)
				}
			case "pickup", "drop", "defuse_start", "defuse_abort":
				if bomb.Site != nil {
					return fmt.Errorf("round %d bomb event %s at tick %d should not carry a site", round.RoundNumber, bomb.Type, bomb.Tick)
				}
			}
		}

		for _, utility := range round.UtilityEntities {
			if utility.StartTick < round.StartTick || utility.StartTick > round.EndTick {
				return fmt.Errorf("round %d utility %s starts outside round bounds", round.RoundNumber, utility.UtilityID)
			}

			if utility.DetonateTick != nil && *utility.DetonateTick < utility.StartTick {
				return fmt.Errorf("round %d utility %s detonates before it starts", round.RoundNumber, utility.UtilityID)
			}

			if utility.EndTick != nil && *utility.EndTick < utility.StartTick {
				return fmt.Errorf("round %d utility %s ends before it starts", round.RoundNumber, utility.UtilityID)
			}

			if len(utility.Trajectory.X) != len(utility.Trajectory.Y) || len(utility.Trajectory.X) != len(utility.Trajectory.Z) {
				return fmt.Errorf("round %d utility %s trajectory arrays differ in length", round.RoundNumber, utility.UtilityID)
			}

			for _, phase := range utility.PhaseEvents {
				if phase.Tick < utility.StartTick {
					return fmt.Errorf("round %d utility %s phase %s at tick %d is before utility start", round.RoundNumber, utility.UtilityID, phase.Type, phase.Tick)
				}

				if phase.DurationTicks != nil && *phase.DurationTicks <= 0 {
					return fmt.Errorf("round %d utility %s phase %s at tick %d has non-positive duration", round.RoundNumber, utility.UtilityID, phase.Type, phase.Tick)
				}
			}
		}

		for _, stream := range round.PlayerStreams {
			count := len(stream.X)
			if count != len(stream.Y) ||
				count != len(stream.Z) ||
				count != len(stream.Yaw) ||
				count != len(stream.Alive) ||
				count != len(stream.HasBomb) ||
				count != len(stream.Health) ||
				count != len(stream.Armor) ||
				count != len(stream.HasHelmet) ||
				count != len(stream.Money) ||
				count != len(stream.ActiveWeapon) ||
				count != len(stream.ActiveWeaponClass) ||
				count != len(stream.MainWeapon) ||
				count != len(stream.Flashbangs) ||
				count != len(stream.Smokes) ||
				count != len(stream.HEGrenades) ||
				count != len(stream.FireGrenades) ||
				count != len(stream.Decoys) {
				return fmt.Errorf("round %d player stream %s array lengths differ", round.RoundNumber, stream.PlayerID)
			}

			if count == 0 {
				return fmt.Errorf("round %d player stream %s has no samples", round.RoundNumber, stream.PlayerID)
			}

			if stream.SampleIntervalTicks <= 0 {
				return fmt.Errorf("round %d player stream %s has non-positive sample interval", round.RoundNumber, stream.PlayerID)
			}

			if stream.SampleOriginTick < round.StartTick || stream.SampleOriginTick > effectiveEndTick {
				return fmt.Errorf("round %d player stream %s starts at tick %d outside round bounds", round.RoundNumber, stream.PlayerID, stream.SampleOriginTick)
			}

			lastSampleTick := stream.SampleOriginTick + (count-1)*stream.SampleIntervalTicks
			if lastSampleTick > effectiveEndTick {
				return fmt.Errorf(
					"round %d player stream %s ends at tick %d after effective round end %d",
					round.RoundNumber,
					stream.PlayerID,
					lastSampleTick,
					effectiveEndTick,
				)
			}

			for index := 0; index < count; index++ {
				yaw := stream.Yaw[index]
				if yaw == nil {
					continue
				}

				if !stream.Alive[index] {
					return fmt.Errorf("round %d player stream %s has yaw while not alive at sample %d", round.RoundNumber, stream.PlayerID, index)
				}

				if stream.X[index] == nil || stream.Y[index] == nil || stream.Z[index] == nil {
					return fmt.Errorf("round %d player stream %s has yaw without full position at sample %d", round.RoundNumber, stream.PlayerID, index)
				}

				if math.IsNaN(*yaw) || math.IsInf(*yaw, 0) {
					return fmt.Errorf("round %d player stream %s has non-finite yaw at sample %d", round.RoundNumber, stream.PlayerID, index)
				}

				if *yaw < -180 || *yaw > 180 {
					return fmt.Errorf("round %d player stream %s has out-of-range yaw %.3f at sample %d", round.RoundNumber, stream.PlayerID, *yaw, index)
				}
			}
		}

		lastRoundEnd = round.EndTick
	}

	return nil
}

func effectiveRoundEndTick(round replay.Round) int {
	if round.OfficialEndTick != nil && *round.OfficialEndTick > round.EndTick {
		return *round.OfficialEndTick
	}

	return round.EndTick
}
