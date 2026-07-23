package demo

import (
	"testing"

	common "github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs/common"

	"mastermind/parser/internal/replay"
)

func TestScoreAfterRoundEndAdvancesWinnerFromRoundStartScore(t *testing.T) {
	before := replay.Score{T: 3, CT: 2}

	got := scoreAfterRoundEnd(before, common.TeamTerrorists)
	want := replay.Score{T: 4, CT: 2}
	if got != want {
		t.Fatalf("expected score %+v, got %+v", want, got)
	}
}

func TestScoreAfterRoundEndAdvancesCounterTerroristWinner(t *testing.T) {
	before := replay.Score{T: 3, CT: 2}

	got := scoreAfterRoundEnd(before, common.TeamCounterTerrorists)
	want := replay.Score{T: 3, CT: 3}
	if got != want {
		t.Fatalf("expected score %+v, got %+v", want, got)
	}
}

func TestSameScoreDetectsRestartedScoreboard(t *testing.T) {
	if sameScore(replay.Score{T: 1}, replay.Score{}) {
		t.Fatal("expected a reset scoreboard not to match the ended round score")
	}
	if !sameScore(replay.Score{T: 4, CT: 5}, replay.Score{T: 4, CT: 5}) {
		t.Fatal("expected unchanged scoreboard to match")
	}
}

func TestSameScoreOrientationAllowsHalftimeSideSwap(t *testing.T) {
	if !sameScoreOrientation(replay.Score{T: 5, CT: 7}, replay.Score{T: 7, CT: 5}) {
		t.Fatal("expected halftime side swap to preserve the same team scores")
	}
	if sameScoreOrientation(replay.Score{T: 5, CT: 7}, replay.Score{T: 8, CT: 5}) {
		t.Fatal("expected an unrelated score to be rejected")
	}
}

func TestRoundFreezetimeEndOpensMissingSourceTVRound(t *testing.T) {
	state := &parseState{}
	scoreBefore := replay.Score{T: 2, CT: 3}

	state.handleRoundFreezetimeEnd(416, false, scoreBefore)

	if state.currentRound == nil {
		t.Fatal("expected freeze-end to recover a missing non-warmup round")
	}
	if state.currentRound.StartTick() != 416 {
		t.Fatalf("expected recovered round to start at observable tick 416, got %d", state.currentRound.StartTick())
	}
	if state.currentRound.ScoreBefore() != scoreBefore {
		t.Fatalf("expected score %+v, got %+v", scoreBefore, state.currentRound.ScoreBefore())
	}

	round := state.currentRound.Build(64)
	if round.FreezeEndTick == nil || *round.FreezeEndTick != 416 {
		t.Fatalf("expected freeze-end tick 416, got %v", round.FreezeEndTick)
	}
}

func TestRoundFreezetimeEndDoesNotOpenWarmupRound(t *testing.T) {
	state := &parseState{}

	state.handleRoundFreezetimeEnd(268, true, replay.Score{})

	if state.currentRound != nil {
		t.Fatal("expected warmup freeze-end to remain omitted")
	}
}
