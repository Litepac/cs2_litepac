package events

import (
	"math"
	"time"
)

func FlashDurationTicks(duration time.Duration, tickRate float64) (int, bool) {
	if duration <= 0 || tickRate <= 0 {
		return 0, false
	}

	ticks := int(math.Round(duration.Seconds() * tickRate))
	if ticks <= 0 {
		return 0, false
	}

	return ticks, true
}
