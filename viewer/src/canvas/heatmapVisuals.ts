import { Graphics, type Container } from "pixi.js";

import { worldToScreen, type RadarViewport } from "../maps/transform";
import type { HeatmapBucket, HeatmapScope } from "../replay/heatmapAnalysis";
import type { Replay } from "../replay/types";

const HEATMAP_STOPS = [
  { stop: 0, color: [33, 71, 176] },
  { stop: 0.2, color: [28, 160, 255] },
  { stop: 0.42, color: [54, 214, 178] },
  { stop: 0.62, color: [170, 228, 94] },
  { stop: 0.8, color: [255, 207, 59] },
  { stop: 0.92, color: [255, 118, 33] },
  { stop: 1, color: [255, 58, 28] },
] as const;

export type HeatmapVisualCell = {
  alpha: number;
  color: number;
  worldHeight: number;
  worldWidth: number;
  worldX: number;
  worldY: number;
};

type FieldCell = {
  column: number;
  row: number;
  value: number;
};

type HeatmapTuning = {
  alphaRange: number;
  baseAlpha: number;
  fieldRadiusCells: number;
  minimumVisibleIntensity: number;
  overlapInsetMultiplier: number;
};

export function buildHeatmapVisualCells(
  replay: Replay,
  snapshot: {
    buckets: HeatmapBucket[];
    cellSize: number;
    maxSampleCount: number;
    scope: HeatmapScope;
  },
  selectedPlayerActive: boolean,
) {
  if (snapshot.buckets.length === 0 || snapshot.maxSampleCount <= 0) {
    return [];
  }

  const tuning = resolveHeatmapTuning(snapshot.scope, selectedPlayerActive);
  const smoothedField = buildSmoothedField(
    snapshot.buckets,
    snapshot.maxSampleCount,
    tuning.fieldRadiusCells,
  );
  if (smoothedField.length === 0) {
    return [];
  }

  const maxFieldValue = Math.max(...smoothedField.map((cell) => cell.value));
  const minX = replay.map.coordinateSystem.worldXMin;
  const minY = replay.map.coordinateSystem.worldYMin;
  const alphaScale = selectedPlayerActive ? 1.08 : 1;
  const worldCellSize = snapshot.cellSize;
  const inset = worldCellSize * tuning.overlapInsetMultiplier;

  return smoothedField
    .map((cell) => {
      const normalized = maxFieldValue > 0 ? cell.value / maxFieldValue : 0;
      const visibleIntensity = normalizeVisibleIntensity(normalized, tuning.minimumVisibleIntensity);
      if (visibleIntensity <= 0) {
        return null;
      }

      return {
        alpha: (tuning.baseAlpha + visibleIntensity * tuning.alphaRange) * alphaScale,
        color: interpolateHeatmapColor(visibleIntensity),
        worldHeight: worldCellSize + inset * 2,
        worldWidth: worldCellSize + inset * 2,
        worldX: minX + cell.column * worldCellSize - inset,
        worldY: minY + cell.row * worldCellSize - inset,
      } satisfies HeatmapVisualCell;
    })
    .filter((cell): cell is HeatmapVisualCell => cell != null);
}

export function drawHeatmapCellVisual(
  layer: Container,
  replay: Replay,
  cell: HeatmapVisualCell,
  radarViewport: RadarViewport,
) {
  const topLeft = worldToScreen(replay, radarViewport, cell.worldX, cell.worldY);
  const bottomRight = worldToScreen(
    replay,
    radarViewport,
    cell.worldX + cell.worldWidth,
    cell.worldY + cell.worldHeight,
  );

  const x = Math.min(topLeft.x, bottomRight.x);
  const y = Math.min(topLeft.y, bottomRight.y);
  const width = Math.abs(bottomRight.x - topLeft.x);
  const height = Math.abs(bottomRight.y - topLeft.y);

  const rect = new Graphics();
  rect.rect(x, y, width, height);
  rect.fill({ color: cell.color, alpha: cell.alpha });
  layer.addChild(rect);
}

function buildSmoothedField(
  buckets: HeatmapBucket[],
  maxSampleCount: number,
  fieldRadiusCells: number,
) {
  const field = new Map<string, FieldCell>();

  for (const bucket of buckets) {
    const normalized =
      maxSampleCount > 0 ? Math.log1p(bucket.sampleCount) / Math.log1p(maxSampleCount) : 0;
    if (normalized <= 0) {
      continue;
    }

    for (let rowOffset = -fieldRadiusCells; rowOffset <= fieldRadiusCells; rowOffset += 1) {
      for (let columnOffset = -fieldRadiusCells; columnOffset <= fieldRadiusCells; columnOffset += 1) {
        const distance = Math.sqrt(columnOffset * columnOffset + rowOffset * rowOffset);
        if (distance > fieldRadiusCells) {
          continue;
        }

        const weight = gaussianWeight(distance, fieldRadiusCells * 0.7);
        if (weight <= 0) {
          continue;
        }

        const column = bucket.column + columnOffset;
        const row = bucket.row + rowOffset;
        const key = `${column}:${row}`;
        const contribution = normalized * weight;
        const current = field.get(key);
        if (current) {
          current.value += contribution;
          continue;
        }

        field.set(key, { column, row, value: contribution });
      }
    }
  }

  return [...field.values()];
}

function normalizeVisibleIntensity(normalized: number, minimumVisibleIntensity: number) {
  if (normalized <= minimumVisibleIntensity) {
    return 0;
  }

  const shifted = (normalized - minimumVisibleIntensity) / (1 - minimumVisibleIntensity);
  return Math.max(0, Math.min(1, shifted * shifted * shifted));
}

function gaussianWeight(distance: number, sigma: number) {
  return Math.exp(-(distance * distance) / (2 * sigma * sigma));
}

function interpolateHeatmapColor(intensity: number) {
  const clamped = Math.max(0, Math.min(1, intensity));

  for (let index = 1; index < HEATMAP_STOPS.length; index += 1) {
    const previous = HEATMAP_STOPS[index - 1];
    const next = HEATMAP_STOPS[index];
    if (clamped > next.stop) {
      continue;
    }

    const span = next.stop - previous.stop;
    const blend = span <= 0 ? 0 : (clamped - previous.stop) / span;
    const red = Math.round(previous.color[0] + (next.color[0] - previous.color[0]) * blend);
    const green = Math.round(previous.color[1] + (next.color[1] - previous.color[1]) * blend);
    const blue = Math.round(previous.color[2] + (next.color[2] - previous.color[2]) * blend);
    return (red << 16) | (green << 8) | blue;
  }

  const fallback = HEATMAP_STOPS[HEATMAP_STOPS.length - 1].color;
  return (fallback[0] << 16) | (fallback[1] << 8) | fallback[2];
}

function resolveHeatmapTuning(scope: HeatmapScope, selectedPlayerActive: boolean): HeatmapTuning {
  if (selectedPlayerActive) {
    switch (scope) {
      case "round":
        return {
          alphaRange: 0.26,
          baseAlpha: 0.045,
          fieldRadiusCells: 1,
          minimumVisibleIntensity: 0.09,
          overlapInsetMultiplier: 0.11,
        };
      case "sideBlock":
        return {
          alphaRange: 0.24,
          baseAlpha: 0.04,
          fieldRadiusCells: 1,
          minimumVisibleIntensity: 0.12,
          overlapInsetMultiplier: 0.11,
        };
      case "match":
      default:
        return {
          alphaRange: 0.22,
          baseAlpha: 0.035,
          fieldRadiusCells: 1,
          minimumVisibleIntensity: 0.16,
          overlapInsetMultiplier: 0.11,
        };
    }
  }

  switch (scope) {
    case "round":
      return {
        alphaRange: 0.22,
        baseAlpha: 0.04,
        fieldRadiusCells: 1,
        minimumVisibleIntensity: 0.18,
        overlapInsetMultiplier: 0.13,
      };
    case "sideBlock":
      return {
        alphaRange: 0.2,
        baseAlpha: 0.035,
        fieldRadiusCells: 1,
        minimumVisibleIntensity: 0.24,
        overlapInsetMultiplier: 0.13,
      };
    case "match":
    default:
      return {
        alphaRange: 0.18,
        baseAlpha: 0.03,
        fieldRadiusCells: 1,
        minimumVisibleIntensity: 0.34,
        overlapInsetMultiplier: 0.14,
      };
  }
}
