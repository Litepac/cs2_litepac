import type { Replay } from "../replay/types";

export function resolveInitialRoundTick(round: NonNullable<Replay["rounds"][number]>) {
  const liveStartTick = clampTick(round.freezeEndTick ?? round.startTick, round.startTick, round.endTick);
  const searchEndTick = Math.min(round.endTick, liveStartTick + 64 * 8);
  let firstVisibleTick: number | null = null;
  let firstBalancedTick: number | null = null;
  let bestTick = Math.max(
    liveStartTick,
    Math.min(...round.playerStreams.map((stream) => stream.sampleOriginTick)),
  );
  let bestVisibleCount = -1;

  for (let tick = liveStartTick; tick <= searchEndTick; tick += 1) {
    let ctVisibleCount = 0;
    let tVisibleCount = 0;

    for (const stream of round.playerStreams) {
      const index = tick - stream.sampleOriginTick;
      if (index < 0 || index >= stream.x.length) {
        continue;
      }

      if (!stream.alive[index]) {
        continue;
      }

      if (stream.x[index] == null || stream.y[index] == null) {
        continue;
      }

      if (stream.side === "CT") {
        ctVisibleCount += 1;
      } else if (stream.side === "T") {
        tVisibleCount += 1;
      }
    }

    const visibleCount = ctVisibleCount + tVisibleCount;

    if (visibleCount > 0 && firstVisibleTick == null) {
      firstVisibleTick = tick;
    }

    if (visibleCount >= 8 && ctVisibleCount >= 3 && tVisibleCount >= 3 && firstBalancedTick == null) {
      firstBalancedTick = tick;
    }

    if (visibleCount > bestVisibleCount) {
      bestVisibleCount = visibleCount;
      bestTick = tick;
    }

    if (visibleCount >= 10 && ctVisibleCount >= 5 && tVisibleCount >= 5) {
      return tick;
    }
  }

  if (firstBalancedTick != null) {
    return firstBalancedTick;
  }

  if (firstVisibleTick != null) {
    return firstVisibleTick;
  }

  return bestTick;
}

export function resolveVisibleRoundEndTick(round: NonNullable<Replay["rounds"][number]>) {
  if (round.officialEndTick != null && round.officialEndTick > round.endTick) {
    return round.officialEndTick;
  }

  return round.endTick;
}

export function clampTick(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
