package rounds

import (
	"sort"

	"github.com/golang/geo/r3"

	"mastermind/parser/internal/positions"
	"mastermind/parser/internal/replay"
	"mastermind/parser/internal/utility"
)

type Builder struct {
	round          replay.Round
	playerStreams  map[string]*positions.Builder
	utilityTracker *utility.Tracker
	ended          bool
}

func NewBuilder(roundNumber, startTick int, scoreBefore replay.Score) *Builder {
	return &Builder{
		round: replay.Round{
			RoundNumber:     roundNumber,
			StartTick:       startTick,
			FreezeEndTick:   nil,
			EndTick:         startTick,
			OfficialEndTick: nil,
			ScoreBefore:     scoreBefore,
			ScoreAfter:      scoreBefore,
			WinnerSide:      nil,
			EndReason:       nil,
			PlayerStreams:   []replay.PlayerStream{},
			BlindEvents:     []replay.BlindEvent{},
			FireEvents:      []replay.FireEvent{},
			HurtEvents:      []replay.HurtEvent{},
			KillEvents:      []replay.KillEvent{},
			BombEvents:      []replay.BombEvent{},
			UtilityEntities: []replay.UtilityEntity{},
		},
		playerStreams:  map[string]*positions.Builder{},
		utilityTracker: utility.NewTracker(),
	}
}

func (b *Builder) RoundNumber() int { return b.round.RoundNumber }

func (b *Builder) StartTick() int { return b.round.StartTick }

func (b *Builder) EndTick() int { return b.round.EndTick }

func (b *Builder) HasEnded() bool { return b.ended }

func (b *Builder) SetFreezeEnd(tick int) {
	b.round.FreezeEndTick = replay.Int(tick)
}

func (b *Builder) SetEnd(tick int, winnerSide, endReason *string, scoreAfter replay.Score) {
	b.round.EndTick = tick
	b.round.WinnerSide = winnerSide
	b.round.EndReason = endReason
	b.round.ScoreAfter = scoreAfter
	b.ended = true
}

func (b *Builder) ForceEnd(tick int) {
	b.round.EndTick = tick
}

func (b *Builder) SetOfficialEnd(tick int) {
	b.round.OfficialEndTick = replay.Int(tick)
}

func (b *Builder) AppendKill(event replay.KillEvent) {
	b.round.KillEvents = append(b.round.KillEvents, event)
}

func (b *Builder) AppendFire(event replay.FireEvent) {
	b.round.FireEvents = append(b.round.FireEvents, event)
}

func (b *Builder) AppendBlind(event replay.BlindEvent) {
	b.round.BlindEvents = append(b.round.BlindEvents, event)
}

func (b *Builder) AppendHurt(event replay.HurtEvent) {
	b.round.HurtEvents = append(b.round.HurtEvents, event)
}

func (b *Builder) AppendBombEvent(event replay.BombEvent) {
	b.round.BombEvents = append(b.round.BombEvents, event)
}

func (b *Builder) UtilityTracker() *utility.Tracker {
	return b.utilityTracker
}

func (b *Builder) SamplePlayer(
	tick int,
	playerID string,
	side *string,
	pos r3.Vector,
	hasPosition bool,
	yaw *float64,
	alive bool,
	hasBomb bool,
	health *int,
	armor *int,
	hasHelmet bool,
	money *int,
	activeWeapon *string,
	activeWeaponClass *string,
	mainWeapon *string,
	flashbangs *int,
	smokes *int,
	heGrenades *int,
	fireGrenades *int,
	decoys *int,
) {
	stream, ok := b.playerStreams[playerID]
	if !ok {
		stream = positions.NewBuilder(playerID, side)
		b.playerStreams[playerID] = stream
	}

	var x, y, z *float64
	if hasPosition {
		x = replay.Float64(pos.X)
		y = replay.Float64(pos.Y)
		z = replay.Float64(pos.Z)
	}

	stream.Append(positions.Sample{
		Tick:                tick,
		X:                   x,
		Y:                   y,
		Z:                   z,
		Yaw:                 yaw,
		Alive:               alive,
		HasBomb:             hasBomb,
		Health:              health,
		Armor:               armor,
		Helmet:              hasHelmet,
		Money:               money,
		Weapon:              activeWeapon,
		WeaponClass:         activeWeaponClass,
		MainWeapon:          mainWeapon,
		Flashbangs:          flashbangs,
		Smokes:              smokes,
		HEGrenades:          heGrenades,
		FireGrenades:        fireGrenades,
		Decoys:              decoys,
	})
}

func (b *Builder) Build(tickRate float64) replay.Round {
	out := b.round
	out.PlayerStreams = make([]replay.PlayerStream, 0, len(b.playerStreams))
	for _, stream := range b.playerStreams {
		if built := stream.Build(); built != nil {
			out.PlayerStreams = append(out.PlayerStreams, *built)
		}
	}

	sort.Slice(out.PlayerStreams, func(i, j int) bool {
		return out.PlayerStreams[i].PlayerID < out.PlayerStreams[j].PlayerID
	})
	sort.Slice(out.FireEvents, func(i, j int) bool {
		return out.FireEvents[i].Tick < out.FireEvents[j].Tick
	})
	sort.Slice(out.BlindEvents, func(i, j int) bool {
		return out.BlindEvents[i].Tick < out.BlindEvents[j].Tick
	})
	sort.Slice(out.HurtEvents, func(i, j int) bool {
		return out.HurtEvents[i].Tick < out.HurtEvents[j].Tick
	})
	sort.Slice(out.KillEvents, func(i, j int) bool {
		return out.KillEvents[i].Tick < out.KillEvents[j].Tick
	})
	sort.Slice(out.BombEvents, func(i, j int) bool {
		return out.BombEvents[i].Tick < out.BombEvents[j].Tick
	})
	out.UtilityEntities = b.utilityTracker.Build(tickRate)

	return out
}
