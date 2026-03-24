package demo

import (
	demoevents "github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs/events"
)

func (s *parseState) registerUtilityHandlers() {
	s.parser.RegisterEventHandler(func(e demoevents.GrenadeProjectileThrow) {
		if s.currentRound == nil || s.currentRound.HasEnded() {
			return
		}

		throwerID := nilIfEmpty(s.ensurePlayer(e.Projectile.Thrower))
		s.currentRound.UtilityTracker().TrackThrow(s.parser.CurrentFrame(), e.Projectile, throwerID)
	})

	s.parser.RegisterEventHandler(func(e demoevents.GrenadeProjectileBounce) {
		if s.currentRound == nil || s.currentRound.HasEnded() {
			return
		}

		s.currentRound.UtilityTracker().TrackBounce(s.parser.CurrentFrame(), e.Projectile)
	})

	s.parser.RegisterEventHandler(func(e demoevents.HeExplode) {
		if s.currentRound != nil {
			s.currentRound.UtilityTracker().TrackDetonateByEntity(e.GrenadeEntityID, s.parser.CurrentFrame(), e.Position)
			s.currentRound.UtilityTracker().TrackExpireByEntity(e.GrenadeEntityID, s.parser.CurrentFrame(), e.Position)
			s.currentRound.UtilityTracker().TrackSmokeDisplacementFromHE(s.parser.CurrentFrame(), e.Position, s.parser.TickRate())
		}
	})

	s.parser.RegisterEventHandler(func(e demoevents.FlashExplode) {
		if s.currentRound != nil {
			s.currentRound.UtilityTracker().TrackDetonateByEntity(e.GrenadeEntityID, s.parser.CurrentFrame(), e.Position)
			s.currentRound.UtilityTracker().TrackExpireByEntity(e.GrenadeEntityID, s.parser.CurrentFrame(), e.Position)
		}
	})

	s.parser.RegisterEventHandler(func(e demoevents.SmokeStart) {
		if s.currentRound != nil {
			s.currentRound.UtilityTracker().TrackDetonateByEntity(e.GrenadeEntityID, s.parser.CurrentFrame(), e.Position)
		}
	})

	s.parser.RegisterEventHandler(func(e demoevents.SmokeExpired) {
		if s.currentRound != nil {
			s.currentRound.UtilityTracker().TrackExpireByEntity(e.GrenadeEntityID, s.parser.CurrentFrame(), e.Position)
		}
	})

	s.parser.RegisterEventHandler(func(e demoevents.DecoyStart) {
		if s.currentRound != nil {
			s.currentRound.UtilityTracker().TrackDetonateByEntity(e.GrenadeEntityID, s.parser.CurrentFrame(), e.Position)
		}
	})

	s.parser.RegisterEventHandler(func(e demoevents.DecoyExpired) {
		if s.currentRound != nil {
			s.currentRound.UtilityTracker().TrackExpireByEntity(e.GrenadeEntityID, s.parser.CurrentFrame(), e.Position)
		}
	})

	s.parser.RegisterEventHandler(func(e demoevents.InfernoStart) {
		if s.currentRound != nil {
			s.currentRound.UtilityTracker().TrackInfernoStart(s.parser.CurrentFrame(), e.Inferno, infernoCenter(e.Inferno.Fires()))
		}
	})

	s.parser.RegisterEventHandler(func(e demoevents.InfernoExpired) {
		if s.currentRound != nil {
			s.currentRound.UtilityTracker().TrackInfernoExpire(s.parser.CurrentFrame(), e.Inferno, infernoCenter(e.Inferno.Fires()))
		}
	})

	s.parser.RegisterEventHandler(func(e demoevents.GrenadeProjectileDestroy) {
		if s.currentRound != nil {
			s.currentRound.UtilityTracker().TrackDestroy(s.parser.CurrentFrame(), e.Projectile)
		}
	})
}
