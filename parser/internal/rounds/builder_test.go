package rounds

import (
	"testing"

	"mastermind/parser/internal/replay"
)

func TestBuilderHasNearbyBombEvent(t *testing.T) {
	builder := NewBuilder(1, 100, replay.Score{})
	carrier := replay.String("player:carrier")

	builder.AppendBombEvent(replay.BombEvent{
		Tick:     150,
		Type:     "pickup",
		PlayerID: carrier,
		X:        replay.Float64(1),
		Y:        replay.Float64(2),
		Z:        replay.Float64(3),
	})

	if !builder.HasNearbyBombEvent(151, 2, "pickup", carrier) {
		t.Fatalf("expected nearby pickup event to be found")
	}

	if builder.HasNearbyBombEvent(153, 2, "pickup", carrier) {
		t.Fatalf("did not expect pickup event beyond max tick delta")
	}

	if builder.HasNearbyBombEvent(151, 2, "drop", carrier) {
		t.Fatalf("did not expect mismatched event type to match")
	}
}
