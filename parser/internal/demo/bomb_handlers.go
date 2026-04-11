package demo

import (
	common "github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs/common"
	demoevents "github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs/events"

	norm "mastermind/parser/internal/events"
	"mastermind/parser/internal/replay"
)

func (s *parseState) registerBombHandlers() {
	s.parser.RegisterEventHandler(func(e demoevents.BombPickup) {
		s.lastBombCarrierID = s.ensurePlayer(e.Player)
		s.appendBombEvent("pickup", e.Player, nil, positionOrBomb(s.parser.GameState().Bomb()))
	})

	s.parser.RegisterEventHandler(func(e demoevents.BombDropped) {
		s.lastBombCarrierID = ""
		s.appendBombEvent("drop", e.Player, nil, positionOrBomb(s.parser.GameState().Bomb()))
	})

	s.parser.RegisterEventHandler(func(e demoevents.BombPlantBegin) {
		s.appendBombEvent("plant_start", e.Player, norm.BombSite(e.Site), positionOrNil(e.Player))
	})

	s.parser.RegisterEventHandler(func(e demoevents.BombPlanted) {
		s.lastBombCarrierID = ""
		s.appendBombEvent("planted", e.Player, norm.BombSite(e.Site), positionOrBomb(s.parser.GameState().Bomb()))
	})

	s.parser.RegisterEventHandler(func(e demoevents.BombDefuseStart) {
		s.appendBombEvent("defuse_start", e.Player, nil, positionOrNil(e.Player))
	})

	s.parser.RegisterEventHandler(func(e demoevents.BombDefuseAborted) {
		s.appendBombEvent("defuse_abort", e.Player, nil, positionOrNil(e.Player))
	})

	s.parser.RegisterEventHandler(func(e demoevents.BombDefused) {
		s.lastBombCarrierID = ""
		s.appendBombEvent("defused", e.Player, norm.BombSite(e.Site), positionOrBomb(s.parser.GameState().Bomb()))
	})

	s.parser.RegisterEventHandler(func(e demoevents.BombExplode) {
		s.lastBombCarrierID = ""
		s.appendBombEvent("exploded", e.Player, norm.BombSite(e.Site), positionOrBomb(s.parser.GameState().Bomb()))
	})
}

func (s *parseState) appendBombEvent(eventType string, player *common.Player, site *string, pos samplePosition) {
	if s.currentRound == nil || s.currentRound.HasEnded() {
		return
	}

	playerID := nilIfEmpty(s.ensurePlayer(player))
	if (eventType == "pickup" || eventType == "drop") &&
		s.currentRound.HasNearbyBombEvent(s.parser.CurrentFrame(), syntheticBombEventTickWindow, eventType, playerID) {
		return
	}

	s.currentRound.AppendBombEvent(replay.BombEvent{
		Tick:     s.parser.CurrentFrame(),
		Type:     eventType,
		PlayerID: playerID,
		Site:     site,
		X:        pos.x,
		Y:        pos.y,
		Z:        pos.z,
	})
}
