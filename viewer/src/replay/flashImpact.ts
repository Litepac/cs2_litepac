import type { Round } from "./types";

export const FLASH_IMPACT_LINK_SECONDS = 0.8;

export type RecentFlashImpact = {
  fade: number;
  playerId: string;
  severity: number;
  tick: number;
  utilityId: string;
};

export function buildRecentFlashImpacts(
  round: Round,
  currentTick: number,
  tickRate: number,
): RecentFlashImpact[] {
  const safeTickRate = Math.max(1, tickRate);
  const windowTicks = Math.max(1, Math.round(safeTickRate * FLASH_IMPACT_LINK_SECONDS));
  const maximumBlindTicks = safeTickRate * 5.2;
  const impacts: RecentFlashImpact[] = [];

  for (const event of round.blindEvents) {
    if (!event.utilityId || event.durationTicks <= 0) {
      continue;
    }

    const ageTicks = currentTick - event.tick;
    if (ageTicks < 0 || ageTicks > windowTicks) {
      continue;
    }

    const ageProgress = clamp(ageTicks / windowTicks, 0, 1);
    impacts.push({
      fade: 1 - smoothstep(0.52, 1, ageProgress),
      playerId: event.playerId,
      severity: clamp(event.durationTicks / maximumBlindTicks, 0.06, 1),
      tick: event.tick,
      utilityId: event.utilityId,
    });
  }

  return impacts;
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const normalized = clamp((value - edge0) / Math.max(0.0001, edge1 - edge0), 0, 1);
  return normalized * normalized * (3 - 2 * normalized);
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}
