import {
  analysisScopeLabel,
  collectAnalysisRounds,
  type ReplayAnalysisScope,
  type ReplayAnalysisSourceFilter,
  type ReplayAnalysisTeamFilter,
  type ReplaySideBlock,
} from "./replayAnalysis";
import type { Replay, Round } from "./types";

export type HeatmapScope = ReplayAnalysisScope;
export type HeatmapTeamFilter = ReplayAnalysisTeamFilter;
export type HeatmapSourceFilter = ReplayAnalysisSourceFilter;

export type HeatmapBucket = {
  column: number;
  ctSampleCount: number;
  key: string;
  row: number;
  sampleCount: number;
  tSampleCount: number;
};

export type HeatmapSnapshot = {
  buckets: HeatmapBucket[];
  cellSize: number;
  maxSampleCount: number;
  playerCount: number;
  roundCount: number;
  sampleCount: number;
};

export type HeatmapConfig = {
  scope: HeatmapScope;
  sourceFilter: HeatmapSourceFilter;
  teamFilter: HeatmapTeamFilter;
};

type CellAccumulator = {
  count: number;
  ctCount: number;
  column: number;
  row: number;
  tCount: number;
};

export function heatmapScopeLabel(
  replay: Replay,
  activeRoundIndex: number,
  sideBlocks: ReplaySideBlock[],
  scope: HeatmapScope,
) {
  return analysisScopeLabel(replay, activeRoundIndex, sideBlocks, scope);
}

export function collectHeatmapSnapshot(
  replay: Replay,
  activeRoundIndex: number,
  sideBlocks: ReplaySideBlock[],
  selectedPlayerId: string | null,
  config: HeatmapConfig,
): HeatmapSnapshot {
  const rounds = collectAnalysisRounds(replay, activeRoundIndex, sideBlocks, config.scope);
  const cellSize = resolveHeatmapCellSize(replay);
  const minX = replay.map.coordinateSystem.worldXMin;
  const minY = replay.map.coordinateSystem.worldYMin;
  const accumulators = new Map<string, CellAccumulator>();
  const includedPlayers = new Set<string>();
  const stepTicks = resolveHeatmapStepTicks(replay, config.scope);
  let sampleCount = 0;

  for (const { round } of rounds) {
    for (const stream of round.playerStreams) {
      if (stream.side == null) {
        continue;
      }

      if (config.teamFilter !== "all" && stream.side !== config.teamFilter) {
        continue;
      }

      if (config.sourceFilter === "selected" && stream.playerId !== selectedPlayerId) {
        continue;
      }

      const samples = sampleHeatmapStream(round, stream, stepTicks);
      if (samples.length === 0) {
        continue;
      }

      includedPlayers.add(stream.playerId);
      for (const sample of samples) {
        const column = Math.floor((sample.x - minX) / cellSize);
        const row = Math.floor((sample.y - minY) / cellSize);
        const key = `${column}:${row}`;
        let accumulator = accumulators.get(key);
        if (!accumulator) {
          accumulator = {
            count: 0,
            ctCount: 0,
            column,
            row,
            tCount: 0,
          };
          accumulators.set(key, accumulator);
        }

        accumulator.count += 1;
        if (stream.side === "CT") {
          accumulator.ctCount += 1;
        } else {
          accumulator.tCount += 1;
        }
        sampleCount += 1;
      }
    }
  }

  const maxSampleCount = Math.max(0, ...[...accumulators.values()].map((entry) => entry.count));
  const buckets = [...accumulators.entries()]
    .map(([key, entry]) => ({
      column: entry.column,
      ctSampleCount: entry.ctCount,
      key,
      row: entry.row,
      sampleCount: entry.count,
      tSampleCount: entry.tCount,
    }) satisfies HeatmapBucket)
    .sort((left, right) => right.sampleCount - left.sampleCount);

  return {
    buckets,
    cellSize,
    maxSampleCount,
    playerCount: includedPlayers.size,
    roundCount: rounds.length,
    sampleCount,
  };
}

function resolveHeatmapCellSize(replay: Replay) {
  const width = Math.abs(replay.map.coordinateSystem.worldXMax - replay.map.coordinateSystem.worldXMin);
  const height = Math.abs(replay.map.coordinateSystem.worldYMax - replay.map.coordinateSystem.worldYMin);
  const longestSide = Math.max(width, height);
  return Math.max(84, longestSide / 48);
}

function resolveHeatmapStepTicks(replay: Replay, scope: HeatmapScope) {
  const tickRate = Math.max(1, replay.match.tickRate || replay.sourceDemo.tickRate || 64);
  switch (scope) {
    case "round":
      return Math.max(4, Math.round(tickRate * 0.12));
    case "sideBlock":
      return Math.max(8, Math.round(tickRate * 0.18));
    case "match":
      return Math.max(12, Math.round(tickRate * 0.22));
    default:
      return Math.max(8, Math.round(tickRate * 0.18));
  }
}

function sampleHeatmapStream(
  round: Round,
  stream: Round["playerStreams"][number],
  stepTicks: number,
) {
  const startTick = round.freezeEndTick ?? round.startTick;
  const endTick =
    round.officialEndTick != null && round.officialEndTick > round.endTick ? round.officialEndTick : round.endTick;
  const samples: Array<{ x: number; y: number }> = [];

  for (let tick = startTick; tick <= endTick; tick += stepTicks) {
    const sampleIndex = tick - stream.sampleOriginTick;
    const alive = stream.alive[sampleIndex] ?? false;
    const x = stream.x[sampleIndex] ?? null;
    const y = stream.y[sampleIndex] ?? null;
    if (!alive || x == null || y == null) {
      continue;
    }

    samples.push({ x, y });
  }

  return samples;
}
