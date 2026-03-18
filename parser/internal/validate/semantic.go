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
