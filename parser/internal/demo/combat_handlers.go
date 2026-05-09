package demo

import (
	demoevents "github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs/events"

	norm "mastermind/parser/internal/events"
	"mastermind/parser/internal/replay"
)

func (s *parseState) registerCombatHandlers() {
	s.parser.RegisterEventHandler(func(e demoevents.Kill) {
		if s.currentRound == nil || s.currentRound.HasEnded() {
			return
		}

		victimID := s.ensurePlayer(e.Victim)
		if victimID == "" {
			return
		}

		killerID := s.ensurePlayer(e.Killer)
		assisterID := s.ensurePlayer(e.Assister)
		killerPos := positionOrNil(e.Killer)
		victimPos := positionOrNil(e.Victim)

		s.currentRound.AppendKill(replay.KillEvent{
			Tick:              s.parser.CurrentFrame(),
			KillerPlayerID:    nilIfEmpty(killerID),
			VictimPlayerID:    victimID,
			AssisterPlayerID:  nilIfEmpty(assisterID),
			WeaponName:        norm.WeaponName(e.Weapon),
			IsHeadshot:        e.IsHeadshot,
			AssistedFlash:     e.AssistedFlash,
			AttackerBlind:     e.AttackerBlind,
			NoScope:           e.NoScope,
			PenetratedObjects: replay.Int(e.PenetratedObjects),
			ThroughSmoke:      replay.Bool(e.ThroughSmoke),
			KillerX:           killerPos.x,
			KillerY:           killerPos.y,
			KillerZ:           killerPos.z,
			VictimX:           victimPos.x,
			VictimY:           victimPos.y,
			VictimZ:           victimPos.z,
		})
	})

	s.parser.RegisterEventHandler(func(e demoevents.WeaponFire) {
		if s.currentRound == nil || s.currentRound.HasEnded() {
			return
		}

		playerID := s.ensurePlayer(e.Shooter)
		if playerID == "" {
			return
		}

		pos := positionOrNil(e.Shooter)
		s.currentRound.AppendFire(replay.FireEvent{
			Tick:       s.parser.CurrentFrame(),
			PlayerID:   nilIfEmpty(playerID),
			WeaponName: norm.WeaponName(e.Weapon),
			X:          pos.x,
			Y:          pos.y,
			Z:          pos.z,
		})
	})

	s.parser.RegisterEventHandler(func(e demoevents.PlayerFlashed) {
		if s.currentRound == nil || s.currentRound.HasEnded() {
			return
		}

		playerID := s.ensurePlayer(e.Player)
		if playerID == "" {
			return
		}

		durationTicks, ok := norm.FlashDurationTicks(e.FlashDuration(), s.parser.TickRate())
		if !ok {
			return
		}

		tick := s.parser.CurrentFrame()
		attackerID := s.ensurePlayer(e.Attacker)
		s.currentRound.AppendBlind(replay.BlindEvent{
			Tick:             tick,
			PlayerID:         playerID,
			AttackerPlayerID: nilIfEmpty(attackerID),
			DurationTicks:    durationTicks,
			EndTick:          tick + durationTicks,
		})
	})

	s.parser.RegisterEventHandler(func(e demoevents.PlayerHurt) {
		if s.currentRound == nil || s.currentRound.HasEnded() {
			return
		}

		victimID := s.ensurePlayer(e.Player)
		if victimID == "" {
			return
		}

		attackerID := s.ensurePlayer(e.Attacker)
		attackerPos := positionOrNil(e.Attacker)
		victimPos := positionOrNil(e.Player)
		s.currentRound.AppendHurt(replay.HurtEvent{
			Tick:              s.parser.CurrentFrame(),
			AttackerPlayerID:  nilIfEmpty(attackerID),
			VictimPlayerID:    nilIfEmpty(victimID),
			WeaponName:        norm.WeaponName(e.Weapon),
			HealthDamageTaken: e.HealthDamageTaken,
			ArmorDamageTaken:  e.ArmorDamageTaken,
			AttackerX:         attackerPos.x,
			AttackerY:         attackerPos.y,
			AttackerZ:         attackerPos.z,
			VictimX:           victimPos.x,
			VictimY:           victimPos.y,
			VictimZ:           victimPos.z,
		})
	})
}
