package rounds

import "mastermind/parser/internal/replay"

type positionStreamBuilder struct {
	started     bool
	hasPosition bool
	startTick   int
	lastTick    int
	lastX       *float64
	lastY       *float64
	lastZ       *float64
	x           []*float64
	y           []*float64
	z           []*float64
}

func newPositionStreamBuilder() *positionStreamBuilder {
	return &positionStreamBuilder{
		x: []*float64{},
		y: []*float64{},
		z: []*float64{},
	}
}

func (b *positionStreamBuilder) Append(tick int, x, y, z *float64) {
	if !b.started {
		b.started = true
		b.startTick = tick
		b.lastTick = tick - 1
	}

	for gapTick := b.lastTick + 1; gapTick < tick; gapTick++ {
		b.appendSample(nil, nil, nil)
	}

	b.appendSample(x, y, z)
	if x != nil && y != nil && z != nil {
		b.hasPosition = true
	}
	b.lastTick = tick
	b.lastX = x
	b.lastY = y
	b.lastZ = z
}

func (b *positionStreamBuilder) Build() *replay.Trajectory {
	if !b.started || !b.hasPosition {
		return nil
	}

	return &replay.Trajectory{
		SampleOriginTick:    b.startTick,
		SampleIntervalTicks: 1,
		X:                   b.x,
		Y:                   b.y,
		Z:                   b.z,
	}
}

func (b *positionStreamBuilder) appendSample(x, y, z *float64) {
	b.x = append(b.x, x)
	b.y = append(b.y, y)
	b.z = append(b.z, z)
}
