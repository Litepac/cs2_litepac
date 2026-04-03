import { Circle, Container, Graphics, Text } from "pixi.js";

import { worldToScreen, type RadarViewport } from "../maps/transform";
import type { Replay } from "../replay/types";
import type { PositionPlayerSnapshot, PositionTrailEntry } from "../replay/positionsAnalysis";
import { resolvePlayerEquipmentState } from "../replay/weapons";
import { drawPlayerMarker } from "./replayStage/renderPlayers";

const CT_COLOR = 0x56b3ff;
const T_COLOR = 0xf2a64b;

export function drawPositionTrailVisual(
  layer: Container,
  overlayLayer: Container,
  replay: Replay,
  entry: PositionTrailEntry,
  radarViewport: RadarViewport,
  options?: {
    emphasize?: boolean;
    hasSelectedPlayer?: boolean;
    markerMode?: "none" | "pathSamples";
    showEndpoints?: boolean;
  },
) {
  const emphasize = options?.emphasize ?? false;
  const hasSelectedPlayer = options?.hasSelectedPlayer ?? false;
  const markerMode = options?.markerMode ?? "pathSamples";
  const showEndpoints = options?.showEndpoints ?? false;
  const stroke = new Graphics();
  const baseColor = entry.side === "CT" ? CT_COLOR : T_COLOR;
  const lineWidth = emphasize ? 2.4 : 1.15;
  const alpha = emphasize ? 0.86 : hasSelectedPlayer ? 0.09 : 0.18;

  let hasPath = false;
  for (const segment of entry.segments) {
    if (segment.points.length < 2) {
      continue;
    }

    let segmentStarted = false;
    for (const point of segment.points) {
      const screenPoint = worldToScreen(replay, radarViewport, point.x, point.y);
      if (!isScreenPointVisible(screenPoint, radarViewport)) {
        segmentStarted = false;
        continue;
      }

      if (!segmentStarted) {
        stroke.moveTo(screenPoint.x, screenPoint.y);
        segmentStarted = true;
        continue;
      }

      stroke.lineTo(screenPoint.x, screenPoint.y);
      hasPath = true;
    }
  }

  if (!hasPath) {
    stroke.destroy();
    return;
  }

  stroke.stroke({
    alpha,
    color: baseColor,
    cap: "round",
    join: "round",
    width: lineWidth,
  });
  layer.addChild(stroke);

  if (!emphasize || !showEndpoints) {
    return;
  }

  for (const segment of entry.segments) {
    if (segment.points.length === 0) {
      continue;
    }

    const start = worldToScreen(replay, radarViewport, segment.points[0].x, segment.points[0].y);
    const end = worldToScreen(
      replay,
      radarViewport,
      segment.points[segment.points.length - 1].x,
      segment.points[segment.points.length - 1].y,
    );
    if (!isScreenPointVisible(start, radarViewport) && !isScreenPointVisible(end, radarViewport)) {
      continue;
    }

    const marker = new Graphics();
    marker.circle(start.x, start.y, 2.4);
    marker.fill({ alpha: 0.3, color: baseColor });
    marker.circle(end.x, end.y, 3.2);
    marker.fill({ alpha: 0.88, color: baseColor });
    marker.circle(end.x, end.y, 6.2);
    marker.stroke({ alpha: 0.22, color: baseColor, width: 1.4 });
    overlayLayer.addChild(marker);

    if (markerMode === "pathSamples") {
      drawSelectedPlayerPathSamples(overlayLayer, replay, radarViewport, entry, segment);
    }
  }
}

export function drawPositionPlayerSnapshotVisual(
  overlayLayer: Container,
  replay: Replay,
  snapshot: PositionPlayerSnapshot,
  radarViewport: RadarViewport,
  options?: {
    active?: boolean;
    onSelectSnapshot?: (snapshot: PositionPlayerSnapshot) => void;
    selectedPlayerFocus?: boolean;
    showRoundNumber?: boolean;
  },
) {
  const baseColor = snapshot.side === "CT" ? CT_COLOR : T_COLOR;
  const screenPoint = worldToScreen(replay, radarViewport, snapshot.x, snapshot.y);
  if (!isScreenPointVisible(screenPoint, radarViewport)) {
    return;
  }
  const active = options?.active ?? false;
  const selectedPlayerFocus = options?.selectedPlayerFocus ?? false;
  const ghostAlpha = active ? 0.98 : selectedPlayerFocus ? 0.42 : 0.18;
  const haloAlpha = active ? 0.26 : selectedPlayerFocus ? 0.1 : 0.05;
  const equipment = resolvePlayerEquipmentState({
    activeWeapon: snapshot.activeWeapon,
    activeWeaponClass: snapshot.activeWeaponClass,
    mainWeapon: snapshot.mainWeapon,
    recentUtilityThrow: false,
  });

  const snapshotLayer = new Container();
  snapshotLayer.eventMode = "static";
  snapshotLayer.cursor = "pointer";
  snapshotLayer.hitArea = new Circle(screenPoint.x, screenPoint.y, active ? 20 : 18);
  snapshotLayer.on("pointertap", () => options?.onSelectSnapshot?.(snapshot));
  overlayLayer.addChild(snapshotLayer);

  const sampleMarker = new Graphics();
  sampleMarker.alpha = ghostAlpha;
  drawPlayerMarker(
    sampleMarker,
    screenPoint.x,
    screenPoint.y,
    snapshot.side,
    active,
    snapshot.yaw,
    snapshot.health,
    equipment.tokenMode,
    equipment.activeUtilityKind,
    null,
  );
  snapshotLayer.addChild(sampleMarker);

  if (snapshot.hasBomb) {
    const bombBadge = new Graphics();
    bombBadge.roundRect(screenPoint.x + 8, screenPoint.y - 12, 9, 9, 2);
    bombBadge.fill({ color: 0x15100a, alpha: active ? 0.92 : 0.48 });
    bombBadge.stroke({ color: 0xffd06c, width: 1.2, alpha: active ? 0.9 : 0.46 });
    bombBadge.rect(screenPoint.x + 10.5, screenPoint.y - 9.5, 4, 4);
    bombBadge.stroke({ color: 0xffd06c, width: 1, alpha: active ? 0.92 : 0.5 });
    snapshotLayer.addChild(bombBadge);
  }

  const halo = new Graphics();
  halo.circle(screenPoint.x, screenPoint.y, active ? 9.6 : 8.6);
  halo.stroke({ color: baseColor, alpha: haloAlpha, width: active ? 1.8 : 1.2 });
  snapshotLayer.addChild(halo);

  if (selectedPlayerFocus && active) {
    drawPositionPlayerNameLabel(snapshotLayer, snapshot, screenPoint.x, screenPoint.y, baseColor, options?.showRoundNumber ?? false);
    return;
  }

  if (options?.showRoundNumber) {
    const roundLabel = new Text({
      text: `${snapshot.displayRoundNumber}`,
      style: {
        fill: 0xf3f7fa,
        fontFamily: "JetBrains Mono, Fira Code, monospace",
        fontSize: 8,
        fontWeight: "800",
      },
    });
    roundLabel.resolution = 2;
    roundLabel.roundPixels = true;
    roundLabel.x = Math.round(screenPoint.x + 8);
    roundLabel.y = Math.round(screenPoint.y - 6);

    const labelBg = new Graphics();
    labelBg.roundRect(roundLabel.x - 3, roundLabel.y - 1, roundLabel.width + 6, roundLabel.height + 2, 3);
    labelBg.fill({ color: 0x091219, alpha: active ? 0.82 : selectedPlayerFocus ? 0.58 : 0.46 });
    labelBg.stroke({ color: baseColor, alpha: active ? 0.5 : selectedPlayerFocus ? 0.3 : 0.18, width: 0.8 });
    roundLabel.alpha = active ? 0.98 : selectedPlayerFocus ? 0.78 : 0.56;
    snapshotLayer.addChild(labelBg);
    snapshotLayer.addChild(roundLabel);
  }
}

function drawPositionPlayerNameLabel(
  layer: Container,
  snapshot: PositionPlayerSnapshot,
  anchorX: number,
  anchorY: number,
  baseColor: number,
  showRoundNumber: boolean,
) {
  const labelText = showRoundNumber
    ? `${compactPlayerLabel(snapshot.playerName, 11)}  R${snapshot.displayRoundNumber}`
    : compactPlayerLabel(snapshot.playerName, 14);
  const label = new Text({
    text: labelText,
    style: {
      fill: 0xf3f7fa,
      fontFamily: "IBM Plex Sans, Segoe UI, sans-serif",
      fontSize: 8,
      fontWeight: "700",
      letterSpacing: 0.12,
    },
  });
  label.resolution = 2;
  label.roundPixels = true;

  const paddingX = 5;
  const paddingY = 2;
  const labelX = Math.round(anchorX - label.width / 2);
  const labelY = Math.round(anchorY + 12);

  const labelBg = new Graphics();
  labelBg.roundRect(labelX - paddingX, labelY - paddingY, label.width + paddingX * 2, label.height + paddingY * 2, 3);
  labelBg.fill({ color: 0x091219, alpha: 0.8 });
  labelBg.stroke({ color: baseColor, alpha: 0.42, width: 0.8 });
  layer.addChild(labelBg);

  label.x = labelX;
  label.y = labelY - 1;
  layer.addChild(label);
}

function drawSelectedPlayerPathSamples(
  overlayLayer: Container,
  replay: Replay,
  radarViewport: RadarViewport,
  entry: PositionTrailEntry,
  segment: PositionTrailEntry["segments"][number],
) {
  const markerIndexes = pickSampleIndexes(segment.points.length, 3);

  for (const [sampleOrder, pointIndex] of markerIndexes.entries()) {
    const point = segment.points[pointIndex];
    const screenPoint = worldToScreen(replay, radarViewport, point.x, point.y);
    if (!isScreenPointVisible(screenPoint, radarViewport)) {
      continue;
    }
    const sampleMarker = new Graphics();
    sampleMarker.x = screenPoint.x;
    sampleMarker.y = screenPoint.y;
    sampleMarker.alpha = pointIndex === segment.points.length - 1 ? 0.94 : sampleOrder === 0 ? 0.42 : 0.28;
    drawPlayerMarker(
      sampleMarker,
      0,
      0,
      entry.side,
      false,
      point.yaw,
      100,
      "rifle",
      null,
      null,
    );
    sampleMarker.scale.set(pointIndex === segment.points.length - 1 ? 0.48 : 0.34);
    overlayLayer.addChild(sampleMarker);

    if (pointIndex !== segment.points.length - 1) {
      continue;
    }

    const roundLabel = new Text({
      text: `${segment.roundNumber}`,
      style: {
        fill: 0xf3f7fa,
        fontFamily: "JetBrains Mono, Fira Code, monospace",
        fontSize: 8,
        fontWeight: "800",
      },
    });
    roundLabel.resolution = 2;
    roundLabel.roundPixels = true;
    roundLabel.x = Math.round(screenPoint.x + 6);
    roundLabel.y = Math.round(screenPoint.y - 6);

    const labelBg = new Graphics();
    labelBg.roundRect(roundLabel.x - 3, roundLabel.y - 1, roundLabel.width + 6, roundLabel.height + 2, 3);
    labelBg.fill({ color: 0x091219, alpha: 0.82 });
    labelBg.stroke({ color: entry.side === "CT" ? CT_COLOR : T_COLOR, alpha: 0.48, width: 0.8 });
    overlayLayer.addChild(labelBg);
    overlayLayer.addChild(roundLabel);
  }
}

function pickSampleIndexes(pointCount: number, sampleTarget: number) {
  if (pointCount <= 0) {
    return [];
  }

  if (pointCount <= sampleTarget) {
    return Array.from({ length: pointCount }, (_, index) => index);
  }

  const indexes = new Set<number>([0, pointCount - 1]);
  const interiorSamples = Math.max(0, sampleTarget - 2);
  for (let sampleIndex = 1; sampleIndex <= interiorSamples; sampleIndex += 1) {
    const ratio = sampleIndex / (interiorSamples + 1);
    indexes.add(Math.floor((pointCount - 1) * ratio));
  }
  return [...indexes].sort((left, right) => left - right);
}

function isScreenPointVisible(point: { x: number; y: number }, radarViewport: RadarViewport) {
  const margin = 4;
  return (
    point.x >= radarViewport.offsetX - margin &&
    point.x <= radarViewport.offsetX + radarViewport.imageWidth * radarViewport.scale + margin &&
    point.y >= radarViewport.offsetY - margin &&
    point.y <= radarViewport.offsetY + radarViewport.imageHeight * radarViewport.scale + margin
  );
}

function compactPlayerLabel(name: string, maxLength: number) {
  if (name.length <= maxLength) {
    return name;
  }

  return `${name.slice(0, Math.max(3, maxLength - 1))}...`;
}
