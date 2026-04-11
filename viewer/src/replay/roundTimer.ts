import { resolveActiveBombState } from "./bombState";
import type { Replay, Round } from "./types";

export type RoundTimerState = {
  display: string;
  phase: "freeze" | "live" | "postplant" | "ended";
  label: string;
};

export function resolveRoundTimer(replay: Replay, round: Round, currentTick: number): RoundTimerState | null {
  const tickRate = replay.match.tickRate || replay.sourceDemo.tickRate || 0;
  if (!Number.isFinite(tickRate) || tickRate <= 0) {
    return null;
  }

  const bombState = resolveActiveBombState(replay, round, currentTick);
  if (bombState?.explodeTick != null) {
    const remainingTicks = Math.max(0, bombState.explodeTick - currentTick);
    return {
      display: formatSeconds(remainingTicks / tickRate),
      label: "C4",
      phase: "postplant",
    };
  }

  const freezeEndTick = round.freezeEndTick ?? round.startTick;
  if (currentTick < freezeEndTick) {
    return {
      display: formatSeconds(Math.max(0, freezeEndTick - currentTick) / tickRate),
      label: "Freeze",
      phase: "freeze",
    };
  }

  const roundTimeSeconds = replay.match.roundTimeSeconds ?? null;
  if (roundTimeSeconds != null && Number.isFinite(roundTimeSeconds) && roundTimeSeconds > 0) {
    const liveElapsedTicks = Math.max(0, currentTick - freezeEndTick);
    const remainingSeconds = Math.max(0, roundTimeSeconds - liveElapsedTicks / tickRate);
    return {
      display: formatSeconds(remainingSeconds),
      label: remainingSeconds > 0 ? "Round" : "Round over",
      phase: remainingSeconds > 0 ? "live" : "ended",
    };
  }

  return null;
}

function formatSeconds(rawSeconds: number) {
  const normalizedSeconds = Math.max(0, Math.round(rawSeconds * 10) / 10);
  const totalSeconds = Math.floor(normalizedSeconds);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
