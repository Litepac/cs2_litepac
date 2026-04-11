import type { Side } from "./derived";
import { interpolatePlayerStreamSample } from "./playerStream";
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

export type PositionPlayerSelection = {
  playerIds: string[];
  side: Side;
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
  selectedPlayers: PositionPlayerSelection[],
  teamFilter: PositionsTeamFilter,
  comparisonOffsetTicks: number,
  showFreezeTime: boolean,
) {
  const snapshots: PositionPlayerSnapshot[] = [];
  const selectedPlayerKeys = new Set(
    selectedPlayers.flatMap((player) =>
      player.playerIds.map((playerId) => toPositionPlayerSelectionKey(playerId, player.side)),
    ),
  );
  const playerById = new Map(replay.players.map((player) => [player.playerId, player]));

  for (const [roundIndex, round] of replay.rounds.entries()) {
    const displayStartTick = showFreezeTime ? round.startTick : resolveInitialRoundTick(round);
    const displayEndTick =
      round.officialEndTick != null && round.officialEndTick > round.endTick ? round.officialEndTick : round.endTick;
    const targetTick = displayStartTick + comparisonOffsetTicks;
    if (targetTick < displayStartTick || targetTick > displayEndTick) {
      continue;
    }

    for (const stream of round.playerStreams) {
      const selectionKey = stream.side ? toPositionPlayerSelectionKey(stream.playerId, stream.side) : null;
      if (selectedPlayerKeys.size > 0 && (!selectionKey || !selectedPlayerKeys.has(selectionKey))) {
        continue;
      }

      if (teamFilter !== "all" && stream.side !== teamFilter) {
        continue;
      }

      const player = playerById.get(stream.playerId);
      if (!player) {
        continue;
      }

      const sample = interpolatePlayerStreamSample(stream, targetTick);
      if (!sample || !sample.alive || sample.x == null || sample.y == null) {
        continue;
      }

      snapshots.push({
        activeWeapon: sample.activeWeapon,
        activeWeaponClass: sample.activeWeaponClass,
        displayRoundNumber: round.roundNumber,
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
    if (selectedPlayerKeys.size === 0 && left.side !== right.side) {
      return left.side === "CT" ? -1 : 1;
    }
    return left.playerName.localeCompare(right.playerName);
  });
}

export function toPositionPlayerSelectionKey(playerId: string, side: Side) {
  return `${side}:${playerId}`;
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
  const sample = interpolatePlayerStreamSample(stream, tick);
  const alive = sample?.alive ?? false;
  const x = sample?.x ?? null;
  const y = sample?.y ?? null;
  const yaw = sample?.yaw ?? null;

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
