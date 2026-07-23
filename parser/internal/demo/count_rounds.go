package demo

import (
	"fmt"
	"os"

	demoinfocs "github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs"
	demoevents "github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs/events"

	"mastermind/parser/internal/replay"
)

func CountRounds(demoPath string) (rounds int, err error) {
	defer func() {
		if recovered := recover(); recovered != nil {
			rounds = 0
			err = fmt.Errorf("count demo rounds crashed: %v", recovered)
		}
	}()

	if demoPath == "" {
		return 0, fmt.Errorf("demo path is required")
	}

	file, err := os.Open(demoPath)
	if err != nil {
		return 0, fmt.Errorf("open demo: %w", err)
	}
	defer file.Close()

	parser := demoinfocs.NewParser(file)
	defer parser.Close()

	activeRound := false
	finalizedRound := false
	endedRound := false
	scoreBefore := replay.Score{}
	scoreAfter := replay.Score{}

	parser.RegisterEventHandler(func(e demoevents.RoundStart) {
		_ = e
		if parser.GameState().IsWarmupPeriod() {
			return
		}

		nextScore := currentScore(parser.GameState())
		if activeRound && !finalizedRound && (!endedRound || sameScoreOrientation(scoreAfter, nextScore)) {
			rounds++
		}
		activeRound = true
		finalizedRound = false
		endedRound = false
		scoreBefore = nextScore
	})

	parser.RegisterEventHandler(func(e demoevents.RoundEnd) {
		if !activeRound || finalizedRound {
			return
		}

		endedRound = true
		scoreAfter = scoreAfterRoundEnd(scoreBefore, e.Winner)
	})

	parser.RegisterEventHandler(func(e demoevents.RoundEndOfficial) {
		_ = e
		if !activeRound || finalizedRound {
			return
		}

		rounds++
		finalizedRound = true
	})

	if err := parser.ParseToEnd(); err != nil {
		return 0, fmt.Errorf("count demo rounds: %w", err)
	}

	if activeRound && !finalizedRound {
		rounds++
	}

	return rounds, nil
}
