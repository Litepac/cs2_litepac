import type { Side } from "./derived";
import {
  analysisScopeLabel,
  collectAnalysisRounds,
  type ReplayAnalysisScope,
  type ReplayAnalysisSourceFilter,
  type ReplayAnalysisTeamFilter,
  type ReplaySideBlock,
} from "./replayAnalysis";
import type { Replay, Round } from "./types";
import { resolveInitialRoundTick } from "../app/replaySession";

export type PositionsScope = ReplayAnalysisScope;
export type PositionsTeamFilter = ReplayAnalysisTeamFilter;
export type PositionsSourceFilter = ReplayAnalysisSourceFilter;
export type PositionsView = "paths" | "player";

export type PositionTrailPoint = {
  tick: number;
  x: number;
  y: number;
  yaw: number | null;
};

export type PositionTrailSegment = {
  displayEndTick: number;
  displayStartTick: number;
  points: PositionTrailPoint[];
  roundIndex: number;
  roundNumber: number;
};

export type PositionTrailEntry = {
  key: string;
  playerId: string;
  playerName: string;
  roundCount: number;
  sampleCount: number;
  segments: PositionTrailSegment[];
  side: Side | null;
};

export type PositionPlayerSnapshot = {
  activeWeapon: string | null;
  activeWeaponClass: Round["playerStreams"][number]["activeWeaponClass"][number];
  displayRoundNumber: number;
  hasBomb: boolean;
  health: number | null;
  key: string;
  mainWeapon: string | null;
  playerId: string;
  playerName: string;
  roundIndex: number;
  roundNumber: number;
  side: Side | null;
  targetTick: number;
  x: number;
  y: number;
  yaw: number | null;
};

export type PositionsConfig = {
  scope: PositionsScope;
  sourceFilter: PositionsSourceFilter;
  teamFilter: PositionsTeamFilter;
};

export function positionsScopeLabel(
  replay: Replay,
  activeRoundIndex: number,
  sideBlocks: ReplaySideBlock[],
  scope: PositionsScope,
) {
  return analysisScopeLabel(replay, activeRoundIndex, sideBlocks, scope);
}

export function collectPositionTrailEntries(
  replay: Replay,
  activeRoundIndex: number,
  sideBlocks: ReplaySideBlock[],
  selectedPlayerId: string | null,
  config: PositionsConfig,
): PositionTrailEntry[] {
  const rounds = collectAnalysisRounds(replay, activeRoundIndex, sideBlocks, config.scope);
  const entries = new Map<string, PositionTrailEntry>();
  const stepTicks = resolveTrailStepTicks(replay, config.scope);

  for (const { round, roundIndex } of rounds) {
    for (const stream of round.playerStreams) {
      if (config.teamFilter !== "all" && stream.side !== config.teamFilter) {
        continue;
      }

      if (config.sourceFilter === "selected" && stream.playerId !== selectedPlayerId) {
        continue;
      }

      const player = replay.players.find((entry) => entry.playerId === stream.playerId);
      if (!player) {
        continue;
      }

      const segments = sampleTrailSegments(round, roundIndex, stream, stepTicks);
      if (segments.length === 0) {
        continue;
      }

      const entryKey = `${stream.playerId}:${stream.side ?? "unknown"}`;
      let entry = entries.get(entryKey);
      if (!entry) {
        entry = {
          key: entryKey,
          playerId: stream.playerId,
          playerName: player.displayName,
          roundCount: 0,
          sampleCount: 0,
          segments: [],
          side: stream.side,
        };
        entries.set(entryKey, entry);
      }

      entry.roundCount += 1;
      entry.sampleCount += segments.reduce((sum, segment) => sum + segment.points.length, 0);
      entry.segments.push(...segments);
    }
  }

  return [...entries.values()].sort((left, right) => comparePositionEntries(left, right, selectedPlayerId));
}

export function collectPositionPlayerSnapshots(
  replay: Replay,
  selectedPlayerId: string | null,
  teamFilter: PositionsTeamFilter,
  comparisonOffsetTicks: number,
  showFreezeTime: boolean,
) {
  const snapshots: PositionPlayerSnapshot[] = [];
  const playerById = new Map(replay.players.map((player) => [player.playerId, player]));

  for (const [roundIndex, round] of replay.rounds.entries()) {
    const displayStartTick = showFreezeTime ? round.startTick : resolveInitialRoundTick(round);
    const displayEndTick =
      round.officialEndTick != null && round.officialEndTick > round.endTick ? round.officialEndTick : round.endTick;
    const targetTick = displayStartTick + comparisonOffsetTicks;
    if (targetTick < displayStartTick || targetTick > displayEndTick) {
      continue;
    }

    const selectedPlayerStream =
      selectedPlayerId != null ? round.playerStreams.find((stream) => stream.playerId === selectedPlayerId) ?? null : null;
    if (selectedPlayerStream && teamFilter !== "all" && selectedPlayerStream.side !== teamFilter) {
      continue;
    }

    for (const stream of round.playerStreams) {
      if (selectedPlayerId != null && stream.playerId !== selectedPlayerId) {
        continue;
      }

      if (selectedPlayerId == null && teamFilter !== "all" && stream.side !== teamFilter) {
        continue;
      }

      const player = playerById.get(stream.playerId);
      if (!player) {
        continue;
      }

      const sample = interpolatePositionPlayerSample(stream, targetTick);
      if (!sample || !sample.alive || sample.x == null || sample.y == null) {
        continue;
      }

      snapshots.push({
        activeWeapon: sample.activeWeapon,
        activeWeaponClass: sample.activeWeaponClass,
        displayRoundNumber: roundIndex + 1,
        hasBomb: sample.hasBomb,
        health: sample.health,
        key: `${roundIndex}:${stream.playerId}:${stream.side ?? "unknown"}`,
        mainWeapon: sample.mainWeapon,
        playerId: stream.playerId,
        playerName: player.displayName,
        roundIndex,
        roundNumber: round.roundNumber,
        side: stream.side,
        targetTick,
        x: sample.x,
        y: sample.y,
        yaw: sample.yaw,
      });
    }
  }

  return snapshots.sort((left, right) => {
    if (left.roundIndex !== right.roundIndex) {
      return left.roundIndex - right.roundIndex;
    }
    if (selectedPlayerId == null && left.side !== right.side) {
      return left.side === "CT" ? -1 : 1;
    }
    return left.playerName.localeCompare(right.playerName);
  });
}

function resolveTrailStepTicks(replay: Replay, scope: PositionsScope) {
  const tickRate = Math.max(1, replay.match.tickRate || replay.sourceDemo.tickRate || 64);
  switch (scope) {
    case "round":
      return Math.max(6, Math.round(tickRate * 0.18));
    case "sideBlock":
      return Math.max(12, Math.round(tickRate * 0.28));
    case "match":
      return Math.max(18, Math.round(tickRate * 0.4));
    default:
      return Math.max(12, Math.round(tickRate * 0.28));
  }
}

function sampleTrailSegments(
  round: Round,
  roundIndex: number,
  stream: Round["playerStreams"][number],
  stepTicks: number,
) {
  const displayStartTick = round.freezeEndTick ?? round.startTick;
  const displayEndTick = round.officialEndTick != null && round.officialEndTick > round.endTick ? round.officialEndTick : round.endTick;
  if (displayEndTick <= displayStartTick) {
    return [];
  }

  const segments: PositionTrailSegment[] = [];
  let currentSegment: PositionTrailPoint[] = [];

  for (let tick = displayStartTick; tick <= displayEndTick; tick += stepTicks) {
    appendTrailPoint(round, roundIndex, stream, tick, currentSegment, segments, displayStartTick, displayEndTick);
  }

  if (currentSegment.length > 1) {
    segments.push({
      displayEndTick,
      displayStartTick,
      points: currentSegment,
      roundIndex,
      roundNumber: round.roundNumber,
    });
  }

  return segments;
}

function appendTrailPoint(
  round: Round,
  roundIndex: number,
  stream: Round["playerStreams"][number],
  tick: number,
  currentSegment: PositionTrailPoint[],
  segments: PositionTrailSegment[],
  displayStartTick: number,
  displayEndTick: number,
) {
  const sampleIndex = tick - stream.sampleOriginTick;
  const alive = stream.alive[sampleIndex] ?? false;
  const x = stream.x[sampleIndex] ?? null;
  const y = stream.y[sampleIndex] ?? null;
  const yaw = stream.yaw[sampleIndex] ?? null;

  if (!alive || x == null || y == null) {
    if (currentSegment.length > 1) {
      segments.push({
        displayEndTick,
        displayStartTick,
        points: [...currentSegment],
        roundIndex,
        roundNumber: round.roundNumber,
      });
    }
    currentSegment.length = 0;
    return;
  }

  const previousPoint = currentSegment[currentSegment.length - 1];
  if (previousPoint && previousPoint.x === x && previousPoint.y === y) {
    return;
  }

  currentSegment.push({ tick, x, y, yaw });
}

function comparePositionEntries(left: PositionTrailEntry, right: PositionTrailEntry, selectedPlayerId: string | null) {
  if (selectedPlayerId != null) {
    const leftSelected = left.playerId === selectedPlayerId;
    const rightSelected = right.playerId === selectedPlayerId;
    if (leftSelected !== rightSelected) {
      return leftSelected ? -1 : 1;
    }
  }

  if (left.sampleCount !== right.sampleCount) {
    return right.sampleCount - left.sampleCount;
  }

  if (left.roundCount !== right.roundCount) {
    return right.roundCount - left.roundCount;
  }

  return left.playerName.localeCompare(right.playerName);
}

function interpolatePositionPlayerSample(
  stream: Round["playerStreams"][number],
  currentTick: number,
) {
  const relativeTick = currentTick - stream.sampleOriginTick;
  const baseIndex = Math.floor(relativeTick);
  if (baseIndex < 0 || baseIndex >= stream.x.length) {
    return null;
  }

  const nextIndex = Math.min(stream.x.length - 1, baseIndex + 1);
  const mix = Math.max(0, Math.min(1, relativeTick - baseIndex));

  return {
    alive: stream.alive[baseIndex] ?? false,
    hasBomb: stream.hasBomb[baseIndex] ?? false,
    health: stream.health[baseIndex] ?? null,
    activeWeapon: stream.activeWeapon[baseIndex] ?? null,
    activeWeaponClass: stream.activeWeaponClass[baseIndex] ?? null,
    mainWeapon: stream.mainWeapon[baseIndex] ?? null,
    x: interpolateNullableNumber(stream.x[baseIndex], stream.x[nextIndex], mix),
    y: interpolateNullableNumber(stream.y[baseIndex], stream.y[nextIndex], mix),
    yaw: interpolateAngle(stream.yaw[baseIndex], stream.yaw[nextIndex], mix),
  };
}

function interpolateNullableNumber(left: number | null, right: number | null, mix: number) {
  if (left == null && right == null) {
    return null;
  }

  if (left == null) {
    return right;
  }

  if (right == null) {
    return left;
  }

  return left + (right - left) * mix;
}

function interpolateAngle(left: number | null, right: number | null, mix: number) {
  if (mix <= 0) {
    return left ?? right;
  }

  if (mix >= 1) {
    return right ?? left;
  }

  if (left == null || right == null) {
    return null;
  }

  const delta = ((((right - left) % 360) + 540) % 360) - 180;
  return left + delta * mix;
}
