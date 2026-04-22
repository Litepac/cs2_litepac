package demo

import (
	demoinfocs "github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs"
	common "github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs/common"
	demoevents "github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs/events"

	norm "mastermind/parser/internal/events"
	"mastermind/parser/internal/replay"
	"mastermind/parser/internal/rounds"
)

func (s *parseState) registerRoundHandlers() {
	s.parser.RegisterEventHandler(func(e demoevents.RoundStart) {
		_ = e
		if s.parser.GameState().IsWarmupPeriod() {
			return
		}

		if s.currentRound != nil && !s.currentRound.HasEnded() {
			s.finalizeOpenRound(s.parser.CurrentFrame() - 1)
		}

		s.roundCount++
		s.currentRound = rounds.NewBuilder(s.roundCount, s.parser.CurrentFrame(), currentScore(s.parser.GameState()))
		s.lastBombCarrierID = ""
	})

	s.parser.RegisterEventHandler(func(e demoevents.RoundFreezetimeEnd) {
		_ = e
		if s.currentRound == nil {
			return
		}

		s.currentRound.SetFreezeEnd(s.parser.CurrentFrame())
	})

	s.parser.RegisterEventHandler(func(e demoevents.RoundEnd) {
		if s.currentRound == nil {
			return
		}

		scoreAfter := currentScore(s.parser.GameState())
		switch e.Winner {
		case common.TeamTerrorists:
			scoreAfter.T++
		case common.TeamCounterTerrorists:
			scoreAfter.CT++
		}

		s.currentRound.SetEnd(s.parser.CurrentFrame(), norm.SideFromTeam(e.Winner), norm.RoundEndReason(e.Reason), scoreAfter)
	})

	s.parser.RegisterEventHandler(func(e demoevents.RoundEndOfficial) {
		_ = e
		if s.currentRound == nil {
			return
		}

		s.currentRound.SetOfficialEnd(s.parser.CurrentFrame())
		s.finalizeOpenRound(s.currentRound.EndTick())
	})
}

func (s *parseState) finalizeOpenRound(endTick int) {
	if s.currentRound == nil {
		return
	}

	if !s.currentRound.HasEnded() {
		s.currentRound.ForceEnd(endTick)
	}

	if s.currentRound.OfficialEndTick() == nil {
		s.currentRound.SetOfficialEnd(endTick)
	}

	s.roundList = append(s.roundList, s.currentRound.Build(s.parser.TickRate()))
	if s.progress != nil {
		s.progress(ParseProgress{
			RoundsParsed: len(s.roundList),
			RoundsTotal:  s.expectedRounds,
		})
	}
	s.currentRound = nil
	s.lastBombCarrierID = ""
}

func currentScore(gs demoinfocs.GameState) replay.Score {
	score := replay.Score{}
	if t := gs.TeamTerrorists(); t != nil {
		score.T = t.Score()
	}
	if ct := gs.TeamCounterTerrorists(); ct != nil {
		score.CT = ct.Score()
	}

	return score
}
