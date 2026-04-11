import type { Replay } from "../replay/types";

export function resolveInitialRoundTick(round: NonNullable<Replay["rounds"][number]>) {
  // The replay transport should anchor to the true live-round start so the
  // shared round clock opens at the same moment players see in-game.
  return clampTick(round.freezeEndTick ?? round.startTick, round.startTick, round.endTick);
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
