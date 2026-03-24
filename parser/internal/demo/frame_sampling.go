package demo

import (
	"math"

	"github.com/golang/geo/r3"
	common "github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs/common"
	demoevents "github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs/events"

	norm "mastermind/parser/internal/events"
	"mastermind/parser/internal/replay"
)

func (s *parseState) registerFrameSamplingHandlers() {
	s.parser.RegisterEventHandler(func(e demoevents.FrameDone) {
		_ = e
		if s.currentRound == nil {
			return
		}

		gs := s.parser.GameState()
		s.currentRound.UtilityTracker().SyncInfernos(s.parser.CurrentFrame(), gs.Infernos())
		for _, projectile := range gs.GrenadeProjectiles() {
			if projectile == nil {
				continue
			}

			s.currentRound.UtilityTracker().TrackSample(s.parser.CurrentFrame(), projectile)
		}

		bombCarrierID := ""
		if bomb := gs.Bomb(); bomb != nil && bomb.Carrier != nil {
			bombCarrierID = s.ensurePlayer(bomb.Carrier)
		}

		for _, player := range gs.Participants().All() {
			if player == nil {
				continue
			}

			if player.Team != common.TeamTerrorists && player.Team != common.TeamCounterTerrorists {
				continue
			}

			playerID := s.ensurePlayer(player)
			if playerID == "" {
				continue
			}

			side := norm.SideFromTeam(player.Team)
			pos, hasPosition, yaw := livePosition(player)
			playerState := livePlayerSnapshot(player)
			s.currentRound.SamplePlayer(
				s.parser.CurrentFrame(),
				playerID,
				side,
				pos,
				hasPosition,
				yaw,
				player.IsAlive(),
				playerID == bombCarrierID,
				playerState.health,
				playerState.armor,
				playerState.hasHelmet,
				playerState.money,
				playerState.activeWeapon,
				playerState.activeWeaponClass,
				playerState.mainWeapon,
				playerState.flashbangs,
				playerState.smokes,
				playerState.heGrenades,
				playerState.fireGrenades,
				playerState.decoys,
			)
		}
	})
}

func positionOrNil(player *common.Player) samplePosition {
	if player == nil || player.PlayerPawnEntity() == nil {
		return samplePosition{}
	}

	pos := player.Position()
	return samplePosition{
		x: replay.Float64(pos.X),
		y: replay.Float64(pos.Y),
		z: replay.Float64(pos.Z),
	}
}

func positionOrBomb(bomb *common.Bomb) samplePosition {
	if bomb == nil {
		return samplePosition{}
	}

	pos := bomb.Position()
	return samplePosition{
		x: replay.Float64(pos.X),
		y: replay.Float64(pos.Y),
		z: replay.Float64(pos.Z),
	}
}

func livePosition(player *common.Player) (r3.Vector, bool, *float64) {
	if player == nil || !player.IsAlive() || player.PlayerPawnEntity() == nil {
		return r3.Vector{}, false, nil
	}

	pos := player.Position()
	yaw := sanitizedYaw(float64(player.ViewDirectionX()))
	return pos, true, yaw
}

func sanitizedYaw(value float64) *float64 {
	if math.IsNaN(value) || math.IsInf(value, 0) {
		return nil
	}

	if value < -180 || value > 180 {
		return nil
	}

	return replay.Float64(value)
}

func livePlayerSnapshot(player *common.Player) livePlayerState {
	if player == nil {
		return livePlayerState{}
	}

	health := replay.Int(player.Health())
	armor := replay.Int(player.Armor())
	money := replay.Int(player.Money())
	weapons := player.Weapons()

	var activeWeapon *string
	var activeWeaponClass *string
	if weapon := player.ActiveWeapon(); weapon != nil {
		name := norm.WeaponName(weapon)
		if name != "" {
			activeWeapon = replay.String(name)
		}
		activeWeaponClass = norm.ActiveWeaponClass(weapon)
	}

	mainWeapon := norm.MainWeaponName(weapons, player.ActiveWeapon())
	flashbangs, smokes, heGrenades, fireGrenades, decoys := norm.UtilityInventoryCounts(weapons)

	return livePlayerState{
		health:            health,
		armor:             armor,
		hasHelmet:         player.HasHelmet(),
		money:             money,
		activeWeapon:      activeWeapon,
		activeWeaponClass: activeWeaponClass,
		mainWeapon:        mainWeapon,
		flashbangs:        flashbangs,
		smokes:            smokes,
		heGrenades:        heGrenades,
		fireGrenades:      fireGrenades,
		decoys:            decoys,
	}
}

func infernoCenter(fires common.Fires) r3.Vector {
	list := fires.List()
	if len(list) == 0 {
		return r3.Vector{}
	}

	var sum r3.Vector
	for _, fire := range list {
		sum.X += fire.X
		sum.Y += fire.Y
		sum.Z += fire.Z
	}

	count := float64(len(list))
	return r3.Vector{X: sum.X / count, Y: sum.Y / count, Z: sum.Z / count}
}
