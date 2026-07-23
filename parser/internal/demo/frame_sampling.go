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
		bomb := gs.Bomb()
		if bomb != nil && bomb.Carrier != nil {
			bombCarrierID = s.ensurePlayer(bomb.Carrier)
		}
		s.reconcileBombCarrierTransition(s.parser.CurrentFrame(), bomb, bombCarrierID)
		if bomb != nil && bombCarrierID == "" {
			pos := positionOrBomb(bomb)
			s.currentRound.SampleDroppedBombPosition(s.parser.CurrentFrame(), pos.x, pos.y, pos.z)
		} else {
			s.currentRound.SampleDroppedBombPosition(s.parser.CurrentFrame(), nil, nil, nil)
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
			pos, hasPosition, yaw, pitch, eyePos, hasEyePosition := livePosition(player)
			playerState := livePlayerSnapshot(player)
			s.currentRound.SamplePlayer(
				s.parser.CurrentFrame(),
				playerID,
				side,
				pos,
				hasPosition,
				yaw,
				pitch,
				eyePos,
				hasEyePosition,
				player.IsAlive(),
				playerID == bombCarrierID,
				playerState.health,
				playerState.armor,
				playerState.hasHelmet,
				playerState.money,
				playerState.activeWeapon,
				playerState.activeWeaponClass,
				playerState.mainWeapon,
				playerState.isScoped,
				playerState.zoomLevel,
				playerState.viewmodelFOV,
				playerState.viewmodelOffsetX,
				playerState.viewmodelOffsetY,
				playerState.viewmodelOffsetZ,
				playerState.recoilIndex,
				playerState.isWalking,
				playerState.isDucking,
				playerState.isOnGround,
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

func livePosition(player *common.Player) (r3.Vector, bool, *float64, *float64, r3.Vector, bool) {
	if player == nil || !player.IsAlive() || player.PlayerPawnEntity() == nil {
		return r3.Vector{}, false, nil, nil, r3.Vector{}, false
	}

	pos := player.Position()
	yaw := sanitizedYaw(float64(player.ViewDirectionX()))
	pitch := sanitizedPitch(float64(player.ViewDirectionY()))
	eyePos, hasEyePosition := player.PositionEyes()
	return pos, true, yaw, pitch, eyePos, hasEyePosition
}

func sanitizedYaw(value float64) *float64 {
	if math.IsNaN(value) || math.IsInf(value, 0) {
		return nil
	}

	value = math.Mod(value, 360)
	if value > 180 {
		value -= 360
	}
	if value < -180 {
		value += 360
	}

	if value < -180 || value > 180 {
		return nil
	}

	return replay.Float64(value)
}

func sanitizedPitch(value float64) *float64 {
	if math.IsNaN(value) || math.IsInf(value, 0) {
		return nil
	}

	value = math.Mod(value, 360)
	if value > 180 {
		value -= 360
	}
	if value < -180 {
		value += 360
	}

	if value < -90 || value > 90 {
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
	var zoomLevel *int
	var recoilIndex *float64
	if weapon := player.ActiveWeapon(); weapon != nil {
		name := norm.WeaponName(weapon)
		if name != "" {
			activeWeapon = replay.String(name)
		}
		activeWeaponClass = norm.ActiveWeaponClass(weapon)
		zoomLevel = weaponZoomLevel(weapon)
		recoilIndex = weaponRecoilIndex(weapon)
	}

	mainWeapon := norm.MainWeaponName(weapons, player.ActiveWeapon())
	isAliveWithPawn := player.IsAlive() && player.PlayerPawnEntity() != nil
	var isScoped *bool
	var viewmodelFOV *float64
	var viewmodelOffsetX *float64
	var viewmodelOffsetY *float64
	var viewmodelOffsetZ *float64
	var isWalking *bool
	var isDucking *bool
	var isOnGround *bool
	if isAliveWithPawn {
		isScoped = replay.Bool(player.IsScoped())
		viewmodelFOV = playerViewmodelFOV(player)
		viewmodelOffsetX, viewmodelOffsetY, viewmodelOffsetZ = playerViewmodelOffset(player)
		isWalking = replay.Bool(player.IsWalking())
		isDucking = replay.Bool(player.IsDucking())
		isOnGround = replay.Bool(player.Flags().OnGround())
	}
	flashbangs, smokes, heGrenades, fireGrenades, decoys := norm.UtilityInventoryCounts(weapons)

	return livePlayerState{
		health:            health,
		armor:             armor,
		hasHelmet:         player.HasHelmet(),
		money:             money,
		activeWeapon:      activeWeapon,
		activeWeaponClass: activeWeaponClass,
		mainWeapon:        mainWeapon,
		isScoped:          isScoped,
		zoomLevel:         zoomLevel,
		viewmodelFOV:      viewmodelFOV,
		viewmodelOffsetX:  viewmodelOffsetX,
		viewmodelOffsetY:  viewmodelOffsetY,
		viewmodelOffsetZ:  viewmodelOffsetZ,
		recoilIndex:       recoilIndex,
		isWalking:         isWalking,
		isDucking:         isDucking,
		isOnGround:        isOnGround,
		flashbangs:        flashbangs,
		smokes:            smokes,
		heGrenades:        heGrenades,
		fireGrenades:      fireGrenades,
		decoys:            decoys,
	}
}

func playerViewmodelFOV(player *common.Player) *float64 {
	if player == nil || player.PlayerPawnEntity() == nil {
		return nil
	}

	value, ok := player.PlayerPawnEntity().PropertyValue("m_flViewmodelFOV")
	if !ok {
		return nil
	}

	fov := float64(value.Float())
	if fov <= 0 || math.IsNaN(fov) || math.IsInf(fov, 0) {
		return nil
	}

	return replay.Float64(fov)
}

func playerViewmodelOffset(player *common.Player) (*float64, *float64, *float64) {
	if player == nil || player.PlayerPawnEntity() == nil {
		return nil, nil, nil
	}

	pawn := player.PlayerPawnEntity()
	x, okX := pawn.PropertyValue("m_flViewmodelOffsetX")
	y, okY := pawn.PropertyValue("m_flViewmodelOffsetY")
	z, okZ := pawn.PropertyValue("m_flViewmodelOffsetZ")
	if !okX || !okY || !okZ {
		return nil, nil, nil
	}

	offsetX := float64(x.Float())
	offsetY := float64(y.Float())
	offsetZ := float64(z.Float())
	for _, value := range []float64{offsetX, offsetY, offsetZ} {
		if math.IsNaN(value) || math.IsInf(value, 0) {
			return nil, nil, nil
		}
	}

	return replay.Float64(offsetX), replay.Float64(offsetY), replay.Float64(offsetZ)
}

func weaponZoomLevel(weapon *common.Equipment) *int {
	if weapon == nil || weapon.Entity == nil {
		return nil
	}

	value, ok := weapon.Entity.PropertyValue("m_zoomLevel")
	if !ok {
		return nil
	}

	zoom := value.Int()
	if zoom < 0 {
		return nil
	}

	return replay.Int(zoom)
}

func weaponRecoilIndex(weapon *common.Equipment) *float64 {
	if weapon == nil || weapon.Entity == nil {
		return nil
	}

	value, ok := weapon.Entity.PropertyValue("m_flRecoilIndex")
	if !ok {
		return nil
	}

	recoil := float64(value.Float())
	if recoil < 0 || math.IsNaN(recoil) || math.IsInf(recoil, 0) {
		return nil
	}

	return replay.Float64(recoil)
}
