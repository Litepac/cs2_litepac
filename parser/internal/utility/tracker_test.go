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
