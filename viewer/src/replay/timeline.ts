import type { Replay, Round, UtilityEntity } from "./types";
import { utilityMatchesFocus, type UtilityFocus } from "./utilityFilter";
import { utilityActivationTick, utilityEventTick, utilityLifecycleEndTick } from "./utility";

export type TimelineEventItem = {
  bombType?: "defuse_start" | "defused" | "exploded" | "plant_start" | "planted";
  key: string;
  kind: "bomb" | "kill" | "utility";
  label: string;
  killerSide?: "CT" | "T" | null;
  tick: number;
  utilityKind?: UtilityEntity["kind"];
  utilitySide?: "CT" | "T" | null;
};

export type TimelineUtilityWindow = {
  key: string;
  kind: "decoy" | "fire" | "smoke";
  label: string;
  startTick: number;
  endTick: number;
};

export function buildTimelineMarkers(
  replay: Replay | null,
  round: Replay["rounds"][number] | null,
  utilityFocus: UtilityFocus,
): TimelineEventItem[] {
  if (!replay || !round) {
    return [];
  }

  const playerName = (playerId: string | null) => {
    if (!playerId) {
      return "World";
    }

    return replay.players.find((player) => player.playerId === playerId)?.displayName ?? playerId;
  };

  const playerSide = (playerId: string | null) => {
    if (!playerId) {
      return null;
    }

    return round.playerStreams.find((stream) => stream.playerId === playerId)?.side ?? null;
  };

const utilityMarkers = round.utilityEntities
    .map((utility) => {
      if (!utilityMatchesFocus(utility.kind, utilityFocus)) {
        return null;
      }

      const tick = utilityEventTick(utility);
      if (tick < round.startTick || tick > round.endTick) {
        return null;
      }

      return {
        key: `utility-${utility.utilityId}-${tick}`,
        kind: "utility" as const,
        label: `${playerName(utility.throwerPlayerId)}: ${utilityLabel(utility.kind)}`,
        tick,
        utilityKind: utility.kind,
        utilitySide: playerSide(utility.throwerPlayerId),
      } satisfies TimelineEventItem;
    })
    .filter(isPresent);

  const stageBombMarkers = round.bombEvents
    .filter((event) => ["plant_start", "planted", "defuse_start", "defused", "exploded"].includes(event.type))
    .map((event) => ({
      bombType: event.type as TimelineEventItem["bombType"],
      key: `bomb-${event.tick}-${event.type}`,
      kind: "bomb" as const,
      label: `${playerName(event.playerId)}: bomb ${event.type}${event.site ? ` @ ${event.site}` : ""}`,
      tick: event.tick,
    }));

  return [
    ...round.killEvents.map((event) => ({
      key: `kill-${event.tick}-${event.victimPlayerId}`,
      kind: "kill" as const,
      killerSide: playerSide(event.killerPlayerId),
      label: `${playerName(event.killerPlayerId)} -> ${playerName(event.victimPlayerId)} (${event.weaponName})`,
      tick: event.tick,
    })),
    ...stageBombMarkers,
    ...utilityMarkers,
  ].sort((left, right) => left.tick - right.tick);
}

export function buildUtilityWindows(replay: Replay | null, round: Round | null, utilityFocus: UtilityFocus): TimelineUtilityWindow[] {
  if (!replay || !round) {
    return [];
  }

  const playerName = (playerId: string | null) => {
    if (!playerId) {
      return "World";
    }

    return replay.players.find((player) => player.playerId === playerId)?.displayName ?? playerId;
  };

  return round.utilityEntities
    .map((utility) => {
      if (!utilityMatchesFocus(utility.kind, utilityFocus)) {
        return null;
      }

      const activationTick = utilityActivationTick(utility);
      const endTick = utilityLifecycleEndTick(utility);
      if (activationTick == null || endTick <= activationTick) {
        return null;
      }

      const clippedStart = Math.max(round.startTick, activationTick);
      const clippedEnd = Math.min(round.endTick, endTick);
      if (clippedEnd <= clippedStart) {
        return null;
      }

      const kind = utilityWindowKind(utility.kind);
      if (kind == null) {
        return null;
      }

      return {
        key: `utility-window-${utility.utilityId}`,
        kind,
        label: `${playerName(utility.throwerPlayerId)}: ${utilityLabel(utility.kind)}`,
        startTick: clippedStart,
        endTick: clippedEnd,
      } satisfies TimelineUtilityWindow;
    })
    .filter(isPresent);
}

function utilityWindowKind(kind: UtilityEntity["kind"]) {
  switch (kind) {
    case "smoke":
      return "smoke";
    case "molotov":
    case "incendiary":
      return "fire";
    case "decoy":
      return "decoy";
    default:
      return null;
  }
}

function utilityLabel(kind: UtilityEntity["kind"]) {
  switch (kind) {
    case "flashbang":
      return "flash";
    case "hegrenade":
      return "HE";
    case "molotov":
      return "molotov";
    case "incendiary":
      return "incendiary";
    case "smoke":
      return "smoke";
    case "decoy":
      return "decoy";
    default:
      return kind;
  }
}

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}
