package utility

import (
	"testing"

	"github.com/golang/geo/r3"
	common "github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs/common"
	st "github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs/sendtables"
	stfake "github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs/sendtables/fake"

	"mastermind/parser/internal/replay"
)

func TestSyncInfernosExpiresMissingInfernoFromActiveSet(t *testing.T) {
	tracker := &Tracker{
		byID: map[string]*replay.UtilityEntity{
			"utility-1": {
				UtilityID:    "utility-1",
				Kind:         "molotov",
				StartTick:    100,
				DetonateTick: replay.Int(120),
				PhaseEvents: []replay.UtilityPhaseEvent{
					phaseEvent(120, "detonate", r3.Vector{X: 10, Y: 20, Z: 0}),
				},
			},
		},
		byUnique:               map[int64]string{},
		byEntity:               map[int]string{77: "utility-1"},
		infernoEntityByUtility: map[string]int{"utility-1": 77},
		lastInfernoPosByUtility: map[string]r3.Vector{
			"utility-1": {X: 10, Y: 20, Z: 0},
		},
	}

	tracker.SyncInfernos(180, map[int]*common.Inferno{})

	entry := tracker.byID["utility-1"]
	if entry.EndTick == nil || *entry.EndTick != 180 {
		t.Fatalf("expected inferno to expire at tick 180, got %v", entry.EndTick)
	}

	if len(entry.PhaseEvents) != 2 {
		t.Fatalf("expected detonate + expire phase events, got %d", len(entry.PhaseEvents))
	}

	expire := entry.PhaseEvents[1]
	if expire.Type != "expire" || expire.Tick != 180 {
		t.Fatalf("expected expire phase at tick 180, got %+v", expire)
	}
}

func TestSyncInfernosExpiresInfernoWithoutActiveFires(t *testing.T) {
	entity := new(stfake.Entity)
	entity.On("ID").Return(77)
	entity.On("Position").Return(r3.Vector{X: 30, Y: 40, Z: 0})
	entity.On("PropertyValueMust", "m_fireCount").Return(st.PropertyValue{Any: int32(1)})
	entity.On("PropertyValueMust", "m_bFireIsBurning.0000").Return(st.PropertyValue{Any: false})
	entity.On("Property", "m_firePositions.0000").Return(nil)
	entity.On("PropertyValueMust", "m_fireXDelta.0000").Return(st.PropertyValue{Any: int32(0)})
	entity.On("PropertyValueMust", "m_fireYDelta.0000").Return(st.PropertyValue{Any: int32(0)})
	entity.On("PropertyValueMust", "m_fireZDelta.0000").Return(st.PropertyValue{Any: int32(0)})

	inferno := common.NewInferno(nil, entity, nil)
	tracker := NewTracker()
	tracker.byID["utility-1"] = &replay.UtilityEntity{
		UtilityID:    "utility-1",
		Kind:         "molotov",
		StartTick:    100,
		DetonateTick: replay.Int(120),
		PhaseEvents: []replay.UtilityPhaseEvent{
			phaseEvent(120, "detonate", r3.Vector{X: 30, Y: 40, Z: 0}),
		},
	}
	tracker.byEntity[77] = "utility-1"
	tracker.infernoEntityByUtility["utility-1"] = 77

	tracker.SyncInfernos(181, map[int]*common.Inferno{77: inferno})

	entry := tracker.byID["utility-1"]
	if entry.EndTick == nil || *entry.EndTick != 181 {
		t.Fatalf("expected inferno with zero active fires to expire at tick 181, got %v", entry.EndTick)
	}
}

func TestTrackSmokeDisplacementFromHEAddsDisplacedPhaseToActiveSmoke(t *testing.T) {
	tracker := NewTracker()
	tracker.byID["smoke-1"] = &replay.UtilityEntity{
		UtilityID:    "smoke-1",
		Kind:         "smoke",
		StartTick:    100,
		DetonateTick: replay.Int(120),
		EndTick:      replay.Int(400),
		PhaseEvents: []replay.UtilityPhaseEvent{
			phaseEvent(100, "thrown", r3.Vector{X: 0, Y: 0, Z: 0}),
			phaseEvent(120, "detonate", r3.Vector{X: 300, Y: 400, Z: 0}),
		},
	}

	tracker.TrackSmokeDisplacementFromHE(160, r3.Vector{X: 360, Y: 430, Z: 0}, 64)

	entry := tracker.byID["smoke-1"]
	if len(entry.PhaseEvents) != 3 {
		t.Fatalf("expected displaced phase event to be added, got %d phase events", len(entry.PhaseEvents))
	}

	displaced := entry.PhaseEvents[2]
	if displaced.Type != "displaced" || displaced.Tick != 160 {
		t.Fatalf("expected displaced phase at tick 160, got %+v", displaced)
	}

	if displaced.DurationTicks == nil || *displaced.DurationTicks <= 0 {
		t.Fatalf("expected displaced phase to carry a positive duration, got %+v", displaced.DurationTicks)
	}
}

func TestTrackSmokeDisplacementFromHESkipsInactiveOrDistantSmokes(t *testing.T) {
	tracker := NewTracker()
	tracker.byID["smoke-active"] = &replay.UtilityEntity{
		UtilityID:    "smoke-active",
		Kind:         "smoke",
		StartTick:    100,
		DetonateTick: replay.Int(120),
		EndTick:      replay.Int(200),
		PhaseEvents: []replay.UtilityPhaseEvent{
			phaseEvent(120, "detonate", r3.Vector{X: 0, Y: 0, Z: 0}),
		},
	}
	tracker.byID["smoke-expired"] = &replay.UtilityEntity{
		UtilityID:    "smoke-expired",
		Kind:         "smoke",
		StartTick:    100,
		DetonateTick: replay.Int(120),
		EndTick:      replay.Int(150),
		PhaseEvents: []replay.UtilityPhaseEvent{
			phaseEvent(120, "detonate", r3.Vector{X: 10, Y: 10, Z: 0}),
		},
	}

	tracker.TrackSmokeDisplacementFromHE(160, r3.Vector{X: 500, Y: 500, Z: 0}, 64)

	if len(tracker.byID["smoke-active"].PhaseEvents) != 1 {
		t.Fatalf("expected distant active smoke to stay unchanged, got %+v", tracker.byID["smoke-active"].PhaseEvents)
	}

	if len(tracker.byID["smoke-expired"].PhaseEvents) != 1 {
		t.Fatalf("expected expired smoke to stay unchanged, got %+v", tracker.byID["smoke-expired"].PhaseEvents)
	}
}
