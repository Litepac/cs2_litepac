package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"mastermind/parser/internal/replay"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "usage: replayinspect <file> [<file>...]")
		os.Exit(2)
	}

	for _, arg := range os.Args[1:] {
		if err := inspect(arg); err != nil {
			fmt.Fprintf(os.Stderr, "%s: %v\n", arg, err)
			os.Exit(1)
		}
	}
}

func inspect(path string) error {
	raw, err := os.ReadFile(path)
	if err != nil {
		return err
	}

	var data replay.Replay
	if err := json.Unmarshal(raw, &data); err != nil {
		return err
	}

	killCount := 0
	bombCount := 0
	utilityCount := 0
	emptyStreams := 0
	missingTrajectory := 0
	shortRounds := 0
	longestRound := 0
	for _, round := range data.Rounds {
		duration := round.EndTick - round.StartTick
		if duration < 1 {
			shortRounds++
		}
		if duration > longestRound {
			longestRound = duration
		}

		killCount += len(round.KillEvents)
		bombCount += len(round.BombEvents)
		utilityCount += len(round.UtilityEntities)
		for _, stream := range round.PlayerStreams {
			if len(stream.X) == 0 {
				emptyStreams++
			}
		}
		for _, utility := range round.UtilityEntities {
			if len(utility.Trajectory.X) == 0 {
				missingTrajectory++
			}
		}
	}

	fmt.Printf(
		"%s map=%s rounds=%d players=%d teams=%d tickRate=%.2f kills=%d bombEvents=%d utility=%d emptyStreams=%d zeroTraj=%d shortRounds=%d longestRoundTicks=%d\n",
		filepath.Base(path),
		data.Map.MapID,
		len(data.Rounds),
		len(data.Players),
		len(data.Teams),
		data.Match.TickRate,
		killCount,
		bombCount,
		utilityCount,
		emptyStreams,
		missingTrajectory,
		shortRounds,
		longestRound,
	)

	return nil
}
