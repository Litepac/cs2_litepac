package validate

import (
	"fmt"

	"mastermind/parser/internal/replay"
)

func ValidateReplay(data replay.Replay) error {
	lastRoundEnd := -1
	for _, round := range data.Rounds {
		if round.EndTick < round.StartTick {
			return fmt.Errorf("round %d ends before it starts", round.RoundNumber)
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
		}

		for _, fire := range round.FireEvents {
			endTick := round.EndTick
			if round.OfficialEndTick != nil && *round.OfficialEndTick > endTick {
				endTick = *round.OfficialEndTick
			}

			if fire.Tick < round.StartTick || fire.Tick > endTick {
				return fmt.Errorf("round %d fire event at tick %d is outside round bounds", round.RoundNumber, fire.Tick)
			}
		}

		for _, blind := range round.BlindEvents {
			endTick := round.EndTick
			if round.OfficialEndTick != nil && *round.OfficialEndTick > endTick {
				endTick = *round.OfficialEndTick
			}

			if blind.Tick < round.StartTick || blind.Tick > endTick {
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
			endTick := round.EndTick
			if round.OfficialEndTick != nil && *round.OfficialEndTick > endTick {
				endTick = *round.OfficialEndTick
			}

			if hurt.Tick < round.StartTick || hurt.Tick > endTick {
				return fmt.Errorf("round %d hurt event at tick %d is outside round bounds", round.RoundNumber, hurt.Tick)
			}
		}

		for _, bomb := range round.BombEvents {
			if bomb.Tick < round.StartTick || bomb.Tick > round.EndTick {
				return fmt.Errorf("round %d bomb event at tick %d is outside round bounds", round.RoundNumber, bomb.Tick)
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
		}

		lastRoundEnd = round.EndTick
	}

	return nil
}
