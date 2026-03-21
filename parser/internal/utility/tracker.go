package utility

import (
	"fmt"
	"sort"
	"strings"

	"github.com/golang/geo/r3"
	common "github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs/common"

	norm "mastermind/parser/internal/events"
	"mastermind/parser/internal/replay"
)

type Tracker struct {
	byID     map[string]*replay.UtilityEntity
	byUnique map[int64]string
	byEntity map[int]string

	infernoEntityByUtility  map[string]int
	lastInfernoPosByUtility map[string]r3.Vector
}

func NewTracker() *Tracker {
	return &Tracker{
		byID:                    map[string]*replay.UtilityEntity{},
		byUnique:                map[int64]string{},
		byEntity:                map[int]string{},
		infernoEntityByUtility:  map[string]int{},
		lastInfernoPosByUtility: map[string]r3.Vector{},
	}
}

func (t *Tracker) TrackThrow(tick int, projectile *common.GrenadeProjectile, throwerID *string) {
	if projectile == nil || projectile.WeaponInstance == nil {
		return
	}

	kind, ok := norm.UtilityKind(projectile.WeaponInstance.Type)
	if !ok {
		return
	}

	utilityID := fmt.Sprintf("utility-%d", projectile.UniqueID())
	entityID := projectile.Entity.ID()

	entry := &replay.UtilityEntity{
		UtilityID:       utilityID,
		Kind:            kind,
		ThrowerPlayerID: throwerID,
		StartTick:       tick,
		Trajectory: replay.Trajectory{
			SampleOriginTick:    tick,
			SampleIntervalTicks: 1,
			X:                   []*float64{},
			Y:                   []*float64{},
			Z:                   []*float64{},
		},
		PhaseEvents: []replay.UtilityPhaseEvent{
			phaseEvent(tick, "thrown", projectile.Position()),
		},
	}

	t.byID[utilityID] = entry
	t.byUnique[projectile.UniqueID()] = utilityID
	t.byEntity[entityID] = utilityID
	t.appendTrajectorySample(entry, tick, projectile.Position())
}

func (t *Tracker) TrackBounce(tick int, projectile *common.GrenadeProjectile) {
	entry := t.byProjectile(projectile)
	if entry == nil {
		return
	}

	t.appendTrajectorySample(entry, tick, projectile.Position())
	entry.PhaseEvents = append(entry.PhaseEvents, phaseEvent(tick, "bounce", projectile.Position()))
}

func (t *Tracker) TrackSample(tick int, projectile *common.GrenadeProjectile) {
	entry := t.byProjectile(projectile)
	if entry == nil || projectile == nil {
		return
	}

	t.appendTrajectorySample(entry, tick, projectile.Position())
}

func (t *Tracker) TrackDetonateByEntity(entityID, tick int, pos r3.Vector) {
	entry := t.byEntityID(entityID)
	if entry == nil {
		return
	}

	if entry.DetonateTick == nil {
		entry.DetonateTick = replay.Int(tick)
	}

	entry.PhaseEvents = append(entry.PhaseEvents, phaseEvent(tick, "detonate", pos))
}

func (t *Tracker) TrackExpireByEntity(entityID, tick int, pos r3.Vector) {
	entry := t.byEntityID(entityID)
	if entry == nil {
		return
	}

	if entry.EndTick == nil {
		entry.EndTick = replay.Int(tick)
	}

	entry.PhaseEvents = append(entry.PhaseEvents, phaseEvent(tick, "expire", pos))
}

func (t *Tracker) TrackInfernoStart(tick int, inferno *common.Inferno, pos r3.Vector) {
	entry := t.byInferno(inferno)
	if entry == nil {
		return
	}

	if inferno != nil {
		entityID := inferno.Entity.ID()
		t.byEntity[entityID] = entry.UtilityID
		t.infernoEntityByUtility[entry.UtilityID] = entityID
	}

	t.lastInfernoPosByUtility[entry.UtilityID] = pos

	if entry.DetonateTick == nil {
		entry.DetonateTick = replay.Int(tick)
		entry.PhaseEvents = append(entry.PhaseEvents, phaseEvent(tick, "detonate", pos))
	}
}

func (t *Tracker) TrackInfernoExpire(tick int, inferno *common.Inferno, pos r3.Vector) {
	entry := t.byInferno(inferno)
	if entry == nil {
		return
	}

	if entry.EndTick != nil && *entry.EndTick <= tick {
		return
	}

	if inferno != nil {
		entityID := inferno.Entity.ID()
		t.byEntity[entityID] = entry.UtilityID
		t.infernoEntityByUtility[entry.UtilityID] = entityID
	}

	t.expireInfernoEntry(entry, tick, pos)
}

func (t *Tracker) TrackDestroy(tick int, projectile *common.GrenadeProjectile) {
	entry := t.byProjectile(projectile)
	if entry == nil || projectile == nil {
		return
	}

	t.appendTrajectorySample(entry, tick, projectile.Position())

	if entry.EndTick == nil && entry.DetonateTick == nil && entry.Kind != "molotov" && entry.Kind != "incendiary" {
		entry.EndTick = replay.Int(tick)
	}

	if len(entry.Trajectory.X) > 0 {
		return
	}

	if len(projectile.Trajectory) == 0 {
		return
	}

	traj := replay.Trajectory{
		SampleOriginTick:    int(projectile.Trajectory[0].FrameID),
		SampleIntervalTicks: 1,
		X:                   []*float64{},
		Y:                   []*float64{},
		Z:                   []*float64{},
	}

	prevTick := traj.SampleOriginTick
	for _, point := range projectile.Trajectory {
		frameTick := int(point.FrameID)
		for gap := prevTick + 1; gap < frameTick; gap++ {
			traj.X = append(traj.X, nil)
			traj.Y = append(traj.Y, nil)
			traj.Z = append(traj.Z, nil)
		}

		traj.X = append(traj.X, replay.Float64(point.Position.X))
		traj.Y = append(traj.Y, replay.Float64(point.Position.Y))
		traj.Z = append(traj.Z, replay.Float64(point.Position.Z))
		prevTick = frameTick
	}

	entry.Trajectory = traj
}

func (t *Tracker) SyncInfernos(tick int, infernos map[int]*common.Inferno) {
	activeEntityIDs := make(map[int]struct{}, len(infernos))

	for entityID, inferno := range infernos {
		entry := t.byInferno(inferno)
		if entry == nil {
			continue
		}

		pos, activeFireCount := infernoActiveCenter(inferno)
		t.lastInfernoPosByUtility[entry.UtilityID] = pos

		if entry.DetonateTick == nil {
			entry.DetonateTick = replay.Int(tick)
			entry.PhaseEvents = append(entry.PhaseEvents, phaseEvent(tick, "detonate", pos))
		}

		if activeFireCount == 0 {
			t.expireInfernoEntry(entry, tick, pos)
			continue
		}

		activeEntityIDs[entityID] = struct{}{}
		t.byEntity[entityID] = entry.UtilityID
		t.infernoEntityByUtility[entry.UtilityID] = entityID
	}

	for utilityID, entityID := range t.infernoEntityByUtility {
		if _, ok := activeEntityIDs[entityID]; ok {
			continue
		}

		entry := t.byID[utilityID]
		if entry == nil || entry.EndTick != nil {
			continue
		}

		t.expireInfernoEntry(entry, tick, t.lastInfernoPosByUtility[utilityID])
	}
}

func (t *Tracker) Build(tickRate float64) []replay.UtilityEntity {
	out := make([]replay.UtilityEntity, 0, len(t.byID))
	for _, entry := range t.byID {
		normalizeLifetime(entry, tickRate)
		sort.Slice(entry.PhaseEvents, func(i, j int) bool {
			return entry.PhaseEvents[i].Tick < entry.PhaseEvents[j].Tick
		})
		out = append(out, *entry)
	}

	sort.Slice(out, func(i, j int) bool {
		if out[i].StartTick == out[j].StartTick {
			return out[i].UtilityID < out[j].UtilityID
		}
		return out[i].StartTick < out[j].StartTick
	})

	return out
}

func normalizeLifetime(entry *replay.UtilityEntity, tickRate float64) {
	if entry == nil || entry.DetonateTick == nil {
		return
	}

	expectedTicks, ok := expectedLifetimeTicks(entry.Kind, tickRate)
	if !ok {
		return
	}

	if entry.EndTick == nil {
		entry.EndTick = replay.Int(*entry.DetonateTick + expectedTicks)
		return
	}

	maxAllowedTicks := expectedTicks + int(tickRate*0.75)
	if *entry.EndTick > *entry.DetonateTick+maxAllowedTicks {
		entry.EndTick = replay.Int(*entry.DetonateTick + expectedTicks)
	}
}

func expectedLifetimeTicks(kind string, tickRate float64) (int, bool) {
	safeTickRate := tickRate
	if safeTickRate <= 0 {
		safeTickRate = 64
	}

	switch kind {
	case "smoke":
		return int(safeTickRate * 20), true
	case "molotov", "incendiary":
		return int(safeTickRate * 7), true
	default:
		return 0, false
	}
}

func (t *Tracker) expireInfernoEntry(entry *replay.UtilityEntity, tick int, pos r3.Vector) {
	if entry == nil {
		return
	}

	if entry.EndTick != nil && *entry.EndTick <= tick {
		return
	}

	entry.EndTick = replay.Int(tick)
	t.lastInfernoPosByUtility[entry.UtilityID] = pos
	entry.PhaseEvents = append(entry.PhaseEvents, phaseEvent(tick, "expire", pos))
	delete(t.infernoEntityByUtility, entry.UtilityID)
}

func (t *Tracker) byProjectile(projectile *common.GrenadeProjectile) *replay.UtilityEntity {
	if projectile == nil {
		return nil
	}

	utilityID, ok := t.byUnique[projectile.UniqueID()]
	if !ok {
		return nil
	}

	return t.byID[utilityID]
}

func (t *Tracker) byEntityID(entityID int) *replay.UtilityEntity {
	utilityID, ok := t.byEntity[entityID]
	if !ok {
		return nil
	}

	return t.byID[utilityID]
}

func (t *Tracker) byInferno(inferno *common.Inferno) *replay.UtilityEntity {
	if inferno == nil {
		return nil
	}

	if entry := t.byEntityID(inferno.Entity.ID()); entry != nil {
		return entry
	}

	thrower := inferno.Thrower()
	var throwerID string
	if thrower != nil {
		if thrower.SteamID64 > 0 {
			throwerID = fmt.Sprintf("steam:%d", thrower.SteamID64)
		} else {
			name := strings.TrimSpace(strings.ToLower(thrower.Name))
			name = strings.ReplaceAll(name, " ", "-")
			if name != "" {
				throwerID = fmt.Sprintf("player:%s:%d", name, thrower.UserID)
			}
		}
	}

	var candidate *replay.UtilityEntity
	for _, entry := range t.byID {
		if entry.Kind != "molotov" && entry.Kind != "incendiary" {
			continue
		}

		if entry.DetonateTick != nil {
			continue
		}

		if throwerID != "" {
			if entry.ThrowerPlayerID == nil || *entry.ThrowerPlayerID != throwerID {
				continue
			}
		}

		if candidate == nil || entry.StartTick > candidate.StartTick {
			candidate = entry
		}
	}

	return candidate
}

func phaseEvent(tick int, phaseType string, pos r3.Vector) replay.UtilityPhaseEvent {
	return replay.UtilityPhaseEvent{
		Tick: tick,
		Type: phaseType,
		X:    replay.Float64(pos.X),
		Y:    replay.Float64(pos.Y),
		Z:    replay.Float64(pos.Z),
	}
}

func infernoActiveCenter(inferno *common.Inferno) (r3.Vector, int) {
	if inferno == nil {
		return r3.Vector{}, 0
	}

	fires := inferno.Fires().Active()
	list := fires.List()
	if len(list) == 0 {
		list = inferno.Fires().List()
	}
	if len(list) == 0 {
		return r3.Vector{}, 0
	}

	var sum r3.Vector
	for _, fire := range list {
		sum.X += fire.X
		sum.Y += fire.Y
		sum.Z += fire.Z
	}

	count := float64(len(list))
	return r3.Vector{X: sum.X / count, Y: sum.Y / count, Z: sum.Z / count}, len(fires.List())
}

func (t *Tracker) appendTrajectorySample(entry *replay.UtilityEntity, tick int, pos r3.Vector) {
	if entry == nil {
		return
	}

	traj := &entry.Trajectory
	if traj.SampleIntervalTicks <= 0 {
		traj.SampleIntervalTicks = 1
	}

	if len(traj.X) == 0 {
		traj.SampleOriginTick = tick
		traj.X = append(traj.X, replay.Float64(pos.X))
		traj.Y = append(traj.Y, replay.Float64(pos.Y))
		traj.Z = append(traj.Z, replay.Float64(pos.Z))
		return
	}

	if tick < traj.SampleOriginTick {
		return
	}

	index := tick - traj.SampleOriginTick
	if index < 0 {
		return
	}

	for len(traj.X) <= index {
		traj.X = append(traj.X, nil)
		traj.Y = append(traj.Y, nil)
		traj.Z = append(traj.Z, nil)
	}

	traj.X[index] = replay.Float64(pos.X)
	traj.Y[index] = replay.Float64(pos.Y)
	traj.Z[index] = replay.Float64(pos.Z)
}
