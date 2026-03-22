package demo

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/golang/geo/r3"
	demoinfocs "github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs"
	common "github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs/common"
	demoevents "github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs/events"
	msg "github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs/msg"

	norm "mastermind/parser/internal/events"
	"mastermind/parser/internal/maps"
	"mastermind/parser/internal/replay"
	"mastermind/parser/internal/rounds"
	"mastermind/parser/internal/validate"
)

type Options struct {
	DemoPath   string
	OutputPath string
	SchemaPath string
	AssetsRoot string
}

type playerRef struct {
	Player replay.Player
	Index  int
}

type teamRef struct {
	Team  replay.Team
	Index int
}

type parseState struct {
	parser       demoinfocs.Parser
	replay       replay.Replay
	currentRound *rounds.Builder
	roundList    []replay.Round
	roundCount   int

	mapID string
	notes []string

	players map[string]playerRef
	teams   map[string]teamRef
}

type samplePosition struct {
	x *float64
	y *float64
	z *float64
}

func Parse(opts Options) error {
	if opts.DemoPath == "" {
		return fmt.Errorf("demo path is required")
	}

	assetsRoot, err := maps.ResolveAssetsRoot(opts.AssetsRoot)
	if err != nil {
		return err
	}

	schemaPath, err := validate.SchemaPath(opts.SchemaPath)
	if err != nil {
		return err
	}

	fingerprint, err := fileSHA256(opts.DemoPath)
	if err != nil {
		return err
	}

	file, err := os.Open(opts.DemoPath)
	if err != nil {
		return fmt.Errorf("open demo: %w", err)
	}
	defer file.Close()

	parser := demoinfocs.NewParser(file)
	defer parser.Close()

	state := &parseState{
		parser:  parser,
		replay:  replay.NewReplay(),
		notes:   []string{},
		players: map[string]playerRef{},
		teams:   map[string]teamRef{},
	}

	state.replay.SourceDemo = replay.SourceDemo{
		FileName:     filepath.Base(opts.DemoPath),
		SHA256:       fingerprint,
		TickRate:     0,
		TickCount:    0,
		DemoProtocol: nil,
		Notes:        []string{},
	}

	state.registerHandlers()

	if err := parser.ParseToEnd(); err != nil {
		return fmt.Errorf("parse demo: %w", err)
	}

	state.finalizeOpenRound(parser.CurrentFrame())
	state.replay.SourceDemo.TickRate = parser.TickRate()
	state.replay.SourceDemo.TickCount = parser.CurrentFrame()
	state.replay.SourceDemo.Notes = dedupe(state.notes)
	bombTimeSeconds := bombTimeSeconds(parser.GameState())
	if bombTimeSeconds == nil {
		bombTimeSeconds = inferBombTimeSeconds(state.roundList, parser.TickRate())
	}
	state.replay.Match = replay.Match{
		MatchID:         nil,
		TickRate:        parser.TickRate(),
		TotalRounds:     len(state.roundList),
		GameMode:        nil,
		BombTimeSeconds: bombTimeSeconds,
	}

	if state.mapID == "" {
		return fmt.Errorf("demo parse did not yield a map id")
	}

	calibration, err := maps.Load(assetsRoot, state.mapID)
	if err != nil {
		return err
	}

	state.replay.Map = replay.Map{
		MapID:            calibration.MapID,
		DisplayName:      calibration.DisplayName,
		RadarImageKey:    calibration.RadarImageKey,
		CoordinateSystem: calibration.CoordinateSystem,
	}
	state.replay.Teams = orderedTeams(state.teams)
	state.replay.Players = orderedPlayers(state.players)
	state.replay.Rounds = state.roundList

	if err := validate.ValidateReplay(state.replay); err != nil {
		return err
	}

	if err := validate.ValidateSchema(schemaPath, state.replay); err != nil {
		return err
	}

	if opts.OutputPath == "" {
		opts.OutputPath = filepath.Join(filepath.Dir(opts.DemoPath), "mastermind.replay.json")
	}

	return writeReplay(opts.OutputPath, state.replay)
}

func (s *parseState) registerHandlers() {
	s.parser.RegisterNetMessageHandler(func(info *msg.CSVCMsg_ServerInfo) {
		s.mapID = info.GetMapName()
	})

	s.parser.RegisterEventHandler(func(warn demoevents.ParserWarn) {
		s.notes = append(s.notes, warn.Message)
	})

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
	})

	s.parser.RegisterEventHandler(func(e demoevents.RoundFreezetimeEnd) {
		_ = e
		if s.currentRound == nil {
			return
		}

		s.currentRound.SetFreezeEnd(s.parser.CurrentFrame())
	})

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

	s.parser.RegisterEventHandler(func(e demoevents.BombPickup) {
		s.appendBombEvent("pickup", e.Player, nil, positionOrBomb(s.parser.GameState().Bomb()))
	})

	s.parser.RegisterEventHandler(func(e demoevents.BombDropped) {
		s.appendBombEvent("drop", e.Player, nil, positionOrBomb(s.parser.GameState().Bomb()))
	})

	s.parser.RegisterEventHandler(func(e demoevents.BombPlantBegin) {
		s.appendBombEvent("plant_start", e.Player, norm.BombSite(e.Site), positionOrNil(e.Player))
	})

	s.parser.RegisterEventHandler(func(e demoevents.BombPlanted) {
		s.appendBombEvent("planted", e.Player, norm.BombSite(e.Site), positionOrBomb(s.parser.GameState().Bomb()))
	})

	s.parser.RegisterEventHandler(func(e demoevents.BombDefuseStart) {
		s.appendBombEvent("defuse_start", e.Player, nil, positionOrNil(e.Player))
	})

	s.parser.RegisterEventHandler(func(e demoevents.BombDefuseAborted) {
		s.appendBombEvent("defuse_abort", e.Player, nil, positionOrNil(e.Player))
	})

	s.parser.RegisterEventHandler(func(e demoevents.BombDefused) {
		s.appendBombEvent("defused", e.Player, norm.BombSite(e.Site), positionOrBomb(s.parser.GameState().Bomb()))
	})

	s.parser.RegisterEventHandler(func(e demoevents.BombExplode) {
		s.appendBombEvent("exploded", e.Player, norm.BombSite(e.Site), positionOrBomb(s.parser.GameState().Bomb()))
	})

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

	s.parser.RegisterEventHandler(func(e demoevents.FrameDone) {
		_ = e
		if s.currentRound == nil || s.currentRound.HasEnded() {
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
			health, armor, hasHelmet, money, activeWeapon, mainWeapon, flashbangs, smokes, heGrenades, fireGrenades, decoys := liveEquipment(player)
			s.currentRound.SamplePlayer(
				s.parser.CurrentFrame(),
				playerID,
				side,
				pos,
				hasPosition,
				yaw,
				player.IsAlive(),
				playerID == bombCarrierID,
				health,
				armor,
				hasHelmet,
				money,
				activeWeapon,
				mainWeapon,
				flashbangs,
				smokes,
				heGrenades,
				fireGrenades,
				decoys,
			)
		}
	})
}

func (s *parseState) appendBombEvent(eventType string, player *common.Player, site *string, pos samplePosition) {
	if s.currentRound == nil || s.currentRound.HasEnded() {
		return
	}

	s.currentRound.AppendBombEvent(replay.BombEvent{
		Tick:     s.parser.CurrentFrame(),
		Type:     eventType,
		PlayerID: nilIfEmpty(s.ensurePlayer(player)),
		Site:     site,
		X:        pos.x,
		Y:        pos.y,
		Z:        pos.z,
	})
}

func (s *parseState) finalizeOpenRound(endTick int) {
	if s.currentRound == nil {
		return
	}

	if !s.currentRound.HasEnded() {
		s.currentRound.ForceEnd(endTick)
	}

	s.roundList = append(s.roundList, s.currentRound.Build(s.parser.TickRate()))
	s.currentRound = nil
}

func (s *parseState) ensurePlayer(player *common.Player) string {
	if player == nil {
		return ""
	}

	teamID := teamID(player.TeamState)
	if teamID == "" {
		return ""
	}

	if player.TeamState != nil {
		s.ensureTeam(player.TeamState)
	}

	playerID := stablePlayerID(player)
	if _, ok := s.players[playerID]; ok {
		return playerID
	}

	var steamID *string
	if player.SteamID64 > 0 {
		steamID = replay.String(fmt.Sprintf("%d", player.SteamID64))
	}

	s.players[playerID] = playerRef{
		Player: replay.Player{
			PlayerID:    playerID,
			DisplayName: player.Name,
			SteamID:     steamID,
			TeamID:      teamID,
		},
		Index: len(s.players),
	}

	return playerID
}

func (s *parseState) ensureTeam(team *common.TeamState) string {
	if team == nil {
		return ""
	}

	teamID := teamID(team)
	if _, ok := s.teams[teamID]; ok {
		return teamID
	}

	displayName := team.ClanName()
	if displayName == "" {
		displayName = teamID
	}

	s.teams[teamID] = teamRef{
		Team: replay.Team{
			TeamID:      teamID,
			DisplayName: displayName,
			ClanName:    optionalString(team.ClanName()),
		},
		Index: len(s.teams),
	}

	return teamID
}

func stablePlayerID(player *common.Player) string {
	if player == nil {
		return ""
	}

	if player.SteamID64 > 0 {
		return fmt.Sprintf("steam:%d", player.SteamID64)
	}

	name := strings.TrimSpace(strings.ToLower(player.Name))
	name = strings.ReplaceAll(name, " ", "-")
	if name == "" {
		name = "unknown"
	}

	return fmt.Sprintf("player:%s:%d", name, player.UserID)
}

func teamID(team *common.TeamState) string {
	if team == nil {
		return ""
	}

	return fmt.Sprintf("team:%d", team.ID())
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
	yaw := replay.Float64(float64(player.ViewDirectionX()))
	return pos, true, yaw
}

func liveEquipment(player *common.Player) (*int, *int, bool, *int, *string, *string, *int, *int, *int, *int, *int) {
	if player == nil {
		return nil, nil, false, nil, nil, nil, nil, nil, nil, nil, nil
	}

	health := replay.Int(player.Health())
	armor := replay.Int(player.Armor())
	money := replay.Int(player.Money())
	weapons := player.Weapons()

	var activeWeapon *string
	if weapon := player.ActiveWeapon(); weapon != nil {
		name := norm.WeaponName(weapon)
		if name != "" {
			activeWeapon = replay.String(name)
		}
	}

	mainWeapon := norm.MainWeaponName(weapons, player.ActiveWeapon())
	flashbangs, smokes, heGrenades, fireGrenades, decoys := norm.UtilityInventoryCounts(weapons)

	return health, armor, player.HasHelmet(), money, activeWeapon, mainWeapon, flashbangs, smokes, heGrenades, fireGrenades, decoys
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

func nilIfEmpty(v string) *string {
	if v == "" {
		return nil
	}

	return replay.String(v)
}

func optionalString(v string) *string {
	if strings.TrimSpace(v) == "" {
		return nil
	}

	return replay.String(v)
}

func fileSHA256(path string) (string, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("read demo for hashing: %w", err)
	}

	sum := sha256.Sum256(raw)
	return hex.EncodeToString(sum[:]), nil
}

func bombTimeSeconds(gs demoinfocs.GameState) *float64 {
	seconds, err := gs.Rules().BombTime()
	if err != nil {
		return nil
	}

	value := seconds.Seconds()
	return &value
}

func inferBombTimeSeconds(rounds []replay.Round, tickRate float64) *float64 {
	if tickRate <= 0 {
		return nil
	}

	observedSeconds := make([]float64, 0, len(rounds))
	for _, round := range rounds {
		plantedTick := 0
		explodedTick := 0
		hasPlanted := false
		hasExploded := false
		for index := range round.BombEvents {
			event := round.BombEvents[index]
			if event.Type == "planted" {
				plantedTick = event.Tick
				hasPlanted = true
			}
			if event.Type == "exploded" {
				explodedTick = event.Tick
				hasExploded = true
				break
			}
		}

		if !hasPlanted || !hasExploded || explodedTick <= plantedTick {
			continue
		}

		seconds := float64(explodedTick-plantedTick) / tickRate
		if seconds > 0 {
			observedSeconds = append(observedSeconds, seconds)
		}
	}

	if len(observedSeconds) == 0 {
		return nil
	}

	sort.Float64s(observedSeconds)
	median := observedSeconds[len(observedSeconds)/2]
	rounded := math.Round(median*10) / 10
	return &rounded
}

func writeReplay(path string, data replay.Replay) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("create replay output directory: %w", err)
	}

	raw, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal replay: %w", err)
	}

	raw = append(raw, '\n')
	if err := os.WriteFile(path, raw, 0o644); err != nil {
		return fmt.Errorf("write replay: %w", err)
	}

	return nil
}

func orderedPlayers(entries map[string]playerRef) []replay.Player {
	keys := make([]string, 0, len(entries))
	for key := range entries {
		keys = append(keys, key)
	}
	sort.Slice(keys, func(i, j int) bool { return entries[keys[i]].Index < entries[keys[j]].Index })

	out := make([]replay.Player, 0, len(entries))
	for _, key := range keys {
		out = append(out, entries[key].Player)
	}

	return out
}

func orderedTeams(entries map[string]teamRef) []replay.Team {
	keys := make([]string, 0, len(entries))
	for key := range entries {
		keys = append(keys, key)
	}
	sort.Slice(keys, func(i, j int) bool { return entries[keys[i]].Index < entries[keys[j]].Index })

	out := make([]replay.Team, 0, len(entries))
	for _, key := range keys {
		out = append(out, entries[key].Team)
	}

	return out
}

func dedupe(items []string) []string {
	seen := map[string]struct{}{}
	out := make([]string, 0, len(items))
	for _, item := range items {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}
		if _, ok := seen[item]; ok {
			continue
		}
		seen[item] = struct{}{}
		out = append(out, item)
	}

	return out
}
