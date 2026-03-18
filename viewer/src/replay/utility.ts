import type { Round, UtilityEntity } from "./types";

export type UtilitySceneState = {
  activeStartTick: number | null;
  endTick: number;
  phase: "projectile" | "active" | "burst";
  burstAgeTicks: number | null;
  remainingSeconds: number | null;
};

const DETONATION_BURST_TICKS = 10;

export function activeUtilityCount(round: Round, currentTick: number) {
  return round.utilityEntities.filter((utility) => isUtilityVisibleAtTick(utility, currentTick)).length;
}

export function isUtilityVisibleAtTick(utility: UtilityEntity, currentTick: number) {
  const endTick = utilityLifecycleEndTick(utility);
  return currentTick >= utility.startTick && currentTick <= endTick;
}

export function utilityLifecycleEndTick(utility: UtilityEntity) {
  return utility.endTick ?? utility.detonateTick ?? utility.startTick;
}

export function utilityActivationTick(utility: UtilityEntity) {
  return utilityActiveStartTick(utility);
}

export function utilityEventTick(utility: UtilityEntity) {
  return utility.detonateTick ?? utility.endTick ?? utility.startTick;
}

export function utilitySceneStateAtTick(
  utility: UtilityEntity,
  currentTick: number,
  tickRate: number,
): UtilitySceneState | null {
  if (!isUtilityVisibleAtTick(utility, currentTick)) {
    const burstAgeTicks = utilityBurstAgeTicks(utility, currentTick);
    if (burstAgeTicks == null) {
      return null;
    }

    return {
      activeStartTick: utility.detonateTick,
      burstAgeTicks,
      endTick: utilityLifecycleEndTick(utility),
      phase: "burst",
      remainingSeconds: null,
    };
  }

  const activeStartTick = utilityActiveStartTick(utility);
  const endTick = utilityLifecycleEndTick(utility);
  const hasActiveWindow = activeStartTick != null && endTick > activeStartTick && currentTick >= activeStartTick;

  return {
    activeStartTick,
    burstAgeTicks: null,
    endTick,
    phase: hasActiveWindow ? "active" : "projectile",
    remainingSeconds: hasActiveWindow ? Math.max(0, (endTick - currentTick) / Math.max(1, tickRate)) : null,
  };
}

function utilityActiveStartTick(utility: UtilityEntity) {
  if (utility.detonateTick != null) {
    return utility.detonateTick;
  }

  const detonatePhaseTick = utility.phaseEvents.find((event) => event.type === "detonate")?.tick ?? null;
  if (detonatePhaseTick != null) {
    return detonatePhaseTick;
  }

  if (utility.kind === "molotov" || utility.kind === "incendiary") {
    const lastBounceTick = latestPhaseTick(utility, "bounce");
    return lastBounceTick ?? utility.startTick;
  }

  if (utility.kind === "decoy" && utility.endTick != null && utility.endTick > utility.startTick) {
    return utility.startTick;
  }

  return null;
}

function latestPhaseTick(utility: UtilityEntity, phaseType: string) {
  const ticks = utility.phaseEvents.filter((event) => event.type === phaseType).map((event) => event.tick);
  return ticks.length > 0 ? Math.max(...ticks) : null;
}

function utilityBurstAgeTicks(utility: UtilityEntity, currentTick: number) {
  if (utility.kind !== "flashbang" && utility.kind !== "hegrenade") {
    return null;
  }

  if (utility.detonateTick == null || currentTick < utility.detonateTick) {
    return null;
  }

  const ageTicks = currentTick - utility.detonateTick;
  return ageTicks <= DETONATION_BURST_TICKS ? ageTicks : null;
}
