import type { Round, UtilityEntity } from "./types";

export type UtilitySceneState = {
  activeStartTick: number | null;
  endTick: number;
  phase: "projectile" | "active" | "burst";
  burstAgeTicks: number | null;
  remainingSeconds: number | null;
  presentationRemainingSeconds: number | null;
};

const FLASH_DETONATION_BURST_TICKS = 14;
const HE_DETONATION_BURST_TICKS = 10;

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
  return utility.startTick;
}

export function utilityPresentationRemainingSeconds(
  utility: UtilityEntity,
  currentTick: number,
  tickRate: number,
) {
  const activeStartTick = utilityActiveStartTick(utility);
  if (activeStartTick == null || currentTick < activeStartTick) {
    return null;
  }

  const safeTickRate = Math.max(1, tickRate);
  const expectedActiveTicks = expectedActiveLifetimeTicks(utility, safeTickRate);
  if (expectedActiveTicks == null) {
    return Math.max(0, (utilityLifecycleEndTick(utility) - currentTick) / safeTickRate);
  }

  return Math.max(0, (activeStartTick + expectedActiveTicks - currentTick) / safeTickRate);
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
      presentationRemainingSeconds: null,
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
    presentationRemainingSeconds: hasActiveWindow ? utilityPresentationRemainingSeconds(utility, currentTick, tickRate) : null,
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

function expectedActiveLifetimeTicks(utility: UtilityEntity, tickRate: number) {
  switch (utility.kind) {
    case "smoke":
      return tickRate * 20;
    case "molotov":
    case "incendiary":
      return tickRate * 7;
    default:
      return null;
  }
}

function utilityBurstAgeTicks(utility: UtilityEntity, currentTick: number) {
  if (utility.kind !== "flashbang" && utility.kind !== "hegrenade") {
    return null;
  }

  if (utility.detonateTick == null || currentTick < utility.detonateTick) {
    return null;
  }

  const ageTicks = currentTick - utility.detonateTick;
  const burstTicks = utility.kind === "flashbang" ? FLASH_DETONATION_BURST_TICKS : HE_DETONATION_BURST_TICKS;
  return ageTicks <= burstTicks ? ageTicks : null;
}
