package demo

import (
	common "github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs/common"

	"mastermind/parser/internal/replay"
)

const syntheticBombEventTickWindow = 2

type bombCarrierTransition struct {
	eventType string
	playerID  *string
}

func bombCarrierTransitionEvents(previousCarrierID, currentCarrierID string) []bombCarrierTransition {
	switch {
	case previousCarrierID == currentCarrierID:
		return nil
	case previousCarrierID == "" && currentCarrierID != "":
		return []bombCarrierTransition{{eventType: "pickup", playerID: replay.String(currentCarrierID)}}
	case previousCarrierID != "" && currentCarrierID == "":
		return []bombCarrierTransition{{eventType: "drop", playerID: replay.String(previousCarrierID)}}
	default:
		return []bombCarrierTransition{
			{eventType: "drop", playerID: replay.String(previousCarrierID)},
			{eventType: "pickup", playerID: replay.String(currentCarrierID)},
		}
	}
}

func (s *parseState) reconcileBombCarrierTransition(tick int, bomb *common.Bomb, currentCarrierID string) {
	if s.currentRound == nil || s.currentRound.HasEnded() {
		s.lastBombCarrierID = currentCarrierID
		return
	}

	pos := positionOrBomb(bomb)
	for _, transition := range bombCarrierTransitionEvents(s.lastBombCarrierID, currentCarrierID) {
		if s.currentRound.HasNearbyBombEvent(tick, syntheticBombEventTickWindow, transition.eventType, transition.playerID) {
			continue
		}
		s.currentRound.AppendBombEvent(replay.BombEvent{
			Tick:     tick,
			Type:     transition.eventType,
			PlayerID: transition.playerID,
			Site:     nil,
			X:        pos.x,
			Y:        pos.y,
			Z:        pos.z,
		})
	}

	s.lastBombCarrierID = currentCarrierID
}
