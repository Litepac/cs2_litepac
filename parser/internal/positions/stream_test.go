package positions

import "testing"

func TestAppendCarriesForwardLastSampleAcrossTickGaps(t *testing.T) {
	builder := NewBuilder("player-1", nil)
	builder.Append(Sample{
		Tick:  10,
		Alive: true,
		X:     floatPtr(100),
		Y:     floatPtr(200),
	})
	builder.Append(Sample{
		Tick:  13,
		Alive: true,
		X:     floatPtr(130),
		Y:     floatPtr(230),
	})

	stream := builder.Build()
	if stream == nil {
		t.Fatalf("expected player stream")
	}

	if got := len(stream.X); got != 4 {
		t.Fatalf("expected 4 samples from tick 10 through 13, got %d", got)
	}

	for _, index := range []int{1, 2} {
		if !stream.Alive[index] {
			t.Fatalf("expected carried gap sample %d to stay alive", index)
		}
		if stream.X[index] == nil || *stream.X[index] != 100 {
			t.Fatalf("expected carried gap sample %d X to stay at last known value, got %v", index, stream.X[index])
		}
		if stream.Y[index] == nil || *stream.Y[index] != 200 {
			t.Fatalf("expected carried gap sample %d Y to stay at last known value, got %v", index, stream.Y[index])
		}
	}
}

func floatPtr(value float64) *float64 {
	return &value
}
