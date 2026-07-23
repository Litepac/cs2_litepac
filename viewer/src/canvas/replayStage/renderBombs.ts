import { Container, Graphics, Sprite } from "pixi.js";

import type { RadarViewport } from "../../mapGeometry/transform";
import { worldToScreen } from "../../mapGeometry/transform";
import { resolveActiveBombState, resolveDroppedBombState, type ActiveBombState, type DroppedBombState } from "../../replay/bombState";
import type { Replay, Round } from "../../replay/types";
import { drawTintedEquipmentIcon } from "../equipmentIconGraphics";
import c4IconSvg from "../../icons/cs2-equipment/panorama/images/icons/equipment/c4.svg?raw";
import { RECENT_BOMB_WINDOW_TICKS } from "./constants";
import { clamp } from "./camera";
import { drawBombExplosionEventCue } from "./bombExplosionCue";
import {
  resolveBombDamageSite,
  type BombDamageField,
} from "./bombDamageField";

const BOMB_ICON_SIZE = 32;
const BOMB_ICON = { svg: c4IconSvg, width: BOMB_ICON_SIZE, height: BOMB_ICON_SIZE };
const FIELD_CUE_SECONDS = 1.35;

export function renderBombOverlays(
  layer: Container,
  replay: Replay,
  round: Round,
  currentTick: number,
  radarViewport: RadarViewport,
  bombDamageField: BombDamageField | null,
) {
  const bombState = resolveActiveBombState(replay, round, currentTick);
  if (bombState) {
    drawBombStateOverlay(layer, replay, bombState, currentTick, radarViewport);
  } else {
    const droppedBombState = resolveDroppedBombState(round, currentTick);
    if (droppedBombState) {
      drawDroppedBombOverlay(layer, replay, droppedBombState, currentTick, radarViewport);
    }
  }

  for (const bombEvent of round.bombEvents) {
    drawBombEvent(layer, replay, bombEvent, currentTick, radarViewport, bombDamageField);
  }
}

function drawBombStateOverlay(
  layer: Container,
  replay: Replay,
  state: ActiveBombState,
  currentTick: number,
  radarViewport: RadarViewport,
) {
  const point = worldToScreen(replay, radarViewport, state.x, state.y);
  const bombTimeTotalSeconds =
    state.explodeTick != null ? Math.max(0.1, (state.explodeTick - state.plantedTick) / replay.match.tickRate) : null;
  const bombTimeRemainingSeconds =
    state.explodeTick != null ? Math.max(0, (state.explodeTick - currentTick) / replay.match.tickRate) : null;
  const bombProgress =
    bombTimeRemainingSeconds != null && bombTimeTotalSeconds != null
      ? clamp(bombTimeRemainingSeconds / bombTimeTotalSeconds, 0, 1)
      : null;
  const countdownColor =
    bombTimeRemainingSeconds == null
      ? 0xf3a54d
      : bombTimeRemainingSeconds > 10
        ? 0x37c977
        : bombTimeRemainingSeconds > 5
          ? 0xf3a54d
          : 0xff6a62;
  const marker = new Graphics();
  const outerRadius = 16.9;
  const trackRadius = outerRadius - 2.25;
  const trackWidth = 3.85;
  const baseRadius = 10.9;
  const segmentCount = 16;
  const ringStart = -Math.PI / 2;
  const ringEnd = ringStart + Math.PI * 2 - 0.012;
  marker.circle(point.x, point.y, outerRadius + 3.7);
  marker.fill({ color: 0x04090d, alpha: 0.12 });
  marker.circle(point.x, point.y, outerRadius + 1.1);
  marker.fill({ color: 0x091118, alpha: 0.58 });
  marker.circle(point.x, point.y, outerRadius + 1.1);
  marker.stroke({ color: 0x182632, width: 1.05, alpha: 0.68 });
  drawSegmentedRing(marker, point.x, point.y, trackRadius, ringStart, ringEnd, segmentCount);
  marker.stroke({ color: 0x253645, width: trackWidth, alpha: 0.86, cap: "round" });
  drawSegmentedRing(marker, point.x, point.y, trackRadius, ringStart, ringEnd, segmentCount);
  marker.stroke({ color: 0x0c151f, width: trackWidth - 1.6, alpha: 0.94, cap: "round" });

  if (bombProgress != null) {
    drawSegmentedProgressRing(
      marker,
      point.x,
      point.y,
      trackRadius,
      ringStart,
      ringEnd,
      segmentCount,
      bombProgress,
    );
    marker.stroke({ color: countdownColor, width: trackWidth + 0.8, alpha: 0.12, cap: "round" });
    drawSegmentedProgressRing(
      marker,
      point.x,
      point.y,
      trackRadius,
      ringStart,
      ringEnd,
      segmentCount,
      bombProgress,
    );
    marker.stroke({ color: countdownColor, width: trackWidth, alpha: 0.95, cap: "round" });
  }

  drawBombThresholdMarker(marker, point.x, point.y, trackRadius, trackWidth, bombTimeTotalSeconds, 10, 0xf0b55a);
  drawBombThresholdMarker(marker, point.x, point.y, trackRadius, trackWidth, bombTimeTotalSeconds, 5, 0xff6a62);

  if (state.defuseStartTick != null) {
    const defuseRadius = outerRadius + 2.6;
    if (state.defuseCompletionTick != null && state.defuseCompletionTick > state.defuseStartTick) {
      const progress = clamp(
        (currentTick - state.defuseStartTick) / (state.defuseCompletionTick - state.defuseStartTick),
        0,
        1,
      );
      drawArcStroke(marker, point.x, point.y, defuseRadius, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
      marker.stroke({ color: 0x79c8ff, width: 3.2, alpha: 0.22, cap: "round" });
      drawArcStroke(marker, point.x, point.y, defuseRadius, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
      marker.stroke({ color: 0x79c8ff, width: 2.1, alpha: 0.96, cap: "round" });
    } else {
      const sweepPulse = 0.5 + 0.5 * Math.sin((currentTick - state.defuseStartTick) / 8);
      const sweepStart = -Math.PI / 2 + sweepPulse * 0.5;
      drawArcStroke(marker, point.x, point.y, defuseRadius, sweepStart, sweepStart + Math.PI * 0.72);
      marker.stroke({ color: 0x79c8ff, width: 2.2, alpha: 0.9, cap: "round" });
    }
  }

  marker.circle(point.x, point.y, baseRadius);
  marker.stroke({ color: 0x1f2f3b, width: 0.85, alpha: 0.48 });
  marker.circle(point.x, point.y, 6.95);
  marker.stroke({ color: 0x344654, width: 0.64, alpha: 0.28 });
  drawBombSvgIcon(marker, point.x, point.y, 12.2, countdownColor, 1);
  layer.addChild(marker);
}

function drawDroppedBombOverlay(
  layer: Container,
  replay: Replay,
  state: DroppedBombState,
  currentTick: number,
  radarViewport: RadarViewport,
) {
  const point = worldToScreen(replay, radarViewport, state.x, state.y);
  const pulse = 0.5 + 0.5 * Math.sin((currentTick - state.droppedTick) / 10);
  const glowRadius = 10.6 + pulse * 1.6;
  const marker = new Graphics();

  marker.circle(point.x, point.y, glowRadius + 4.2);
  marker.fill({ color: 0xffd28a, alpha: 0.06 + pulse * 0.05 });
  marker.circle(point.x, point.y, glowRadius + 1.5);
  marker.fill({ color: 0x0b1116, alpha: 0.74 });
  marker.circle(point.x, point.y, glowRadius + 1.5);
  marker.stroke({ color: 0x6f5630, width: 1.05, alpha: 0.92 });
  marker.circle(point.x, point.y, 8.9);
  marker.stroke({ color: 0x162029, width: 0.9, alpha: 0.88 });

  drawBombSvgIcon(marker, point.x, point.y, 11.4, 0xffd28a, 0.98);

  layer.addChild(marker);
}

function drawBombSvgIcon(
  layer: Container,
  x: number,
  y: number,
  maxSize: number,
  color: number,
  alpha: number,
) {
  drawTintedEquipmentIcon(layer, BOMB_ICON, x, y, maxSize, maxSize, color, 0x05080b, alpha, {
    shadowAlpha: 0.66,
    shadowOffsetX: 0.7,
    shadowOffsetY: 0.7,
  });
}

function drawArcStroke(
  marker: Graphics,
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number,
) {
  marker.moveTo(centerX + Math.cos(startAngle) * radius, centerY + Math.sin(startAngle) * radius);
  marker.arc(centerX, centerY, radius, startAngle, endAngle);
}

function drawSegmentedRing(
  marker: Graphics,
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number,
  segments: number,
) {
  const totalArc = endAngle - startAngle;
  const segmentArc = totalArc / segments;
  const gapArc = Math.min(segmentArc * 0.22, 0.07);

  for (let index = 0; index < segments; index++) {
    const segmentStart = startAngle + index * segmentArc;
    const segmentEnd = Math.min(segmentStart + segmentArc - gapArc, endAngle);
    if (segmentEnd <= segmentStart) {
      continue;
    }

    drawArcStroke(marker, centerX, centerY, radius, segmentStart, segmentEnd);
  }
}

function drawSegmentedProgressRing(
  marker: Graphics,
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number,
  segments: number,
  progress: number,
) {
  const totalArc = endAngle - startAngle;
  const segmentArc = totalArc / segments;
  const gapArc = Math.min(segmentArc * 0.22, 0.07);
  const filledArc = totalArc * clamp(progress, 0, 1);

  for (let index = 0; index < segments; index++) {
    const segmentStart = startAngle + index * segmentArc;
    const segmentVisibleEnd = Math.min(segmentStart + segmentArc - gapArc, endAngle);
    const progressEnd = Math.min(startAngle + filledArc, segmentVisibleEnd);
    if (progressEnd <= segmentStart) {
      break;
    }

    drawArcStroke(marker, centerX, centerY, radius, segmentStart, progressEnd);
  }
}

function drawBombThresholdMarker(
  marker: Graphics,
  centerX: number,
  centerY: number,
  radius: number,
  width: number,
  totalBombSeconds: number | null,
  thresholdSeconds: number,
  color: number,
) {
  if (totalBombSeconds == null || thresholdSeconds >= totalBombSeconds) {
    return;
  }

  const progressAtThreshold = clamp(thresholdSeconds / totalBombSeconds, 0, 1);
  const angle = -Math.PI / 2 + progressAtThreshold * Math.PI * 2;
  const innerRadius = radius - width * 0.28;
  const outerRadius = radius + width * 0.48;
  const startX = centerX + Math.cos(angle) * innerRadius;
  const startY = centerY + Math.sin(angle) * innerRadius;
  const endX = centerX + Math.cos(angle) * outerRadius;
  const endY = centerY + Math.sin(angle) * outerRadius;
  marker.moveTo(startX, startY);
  marker.lineTo(endX, endY);
  marker.stroke({ color: 0x091118, width: 2.7, alpha: 0.9, cap: "round" });
  marker.moveTo(startX, startY);
  marker.lineTo(endX, endY);
  marker.stroke({ color, width: 1.35, alpha: 0.95, cap: "round" });
}

function drawBombEvent(
  layer: Container,
  replay: Replay,
  event: Round["bombEvents"][number],
  currentTick: number,
  radarViewport: RadarViewport,
  bombDamageField: BombDamageField | null,
) {
  if (!["defused", "exploded"].includes(event.type)) {
    return;
  }

  if (event.tick > currentTick || currentTick - event.tick > RECENT_BOMB_WINDOW_TICKS / 2) {
    return;
  }

  if (event.x == null || event.y == null) {
    return;
  }

  const ageRatio = 1 - (currentTick - event.tick) / (RECENT_BOMB_WINDOW_TICKS / 2);
  const eventAgeSeconds = (currentTick - event.tick) / replay.match.tickRate;
  const point = worldToScreen(replay, radarViewport, event.x, event.y);
  if (event.type === "exploded") {
    drawMapBombDamageCue(
      layer,
      replay,
      event.x,
      event.y,
      eventAgeSeconds,
      radarViewport,
      bombDamageField,
    );
  }
  const marker = new Graphics();
  marker.circle(point.x, point.y, 10.5);
  marker.fill({ color: 0x081017, alpha: 0.52 + ageRatio * 0.2 });
  if (event.type === "defused") {
    marker.circle(point.x, point.y, 7.6);
    marker.stroke({ color: 0x79c8ff, width: 2.1, alpha: 0.48 + ageRatio * 0.34 });
    marker.moveTo(point.x - 3.3, point.y);
    marker.lineTo(point.x + 3.3, point.y);
    marker.moveTo(point.x, point.y - 3.3);
    marker.lineTo(point.x, point.y + 3.3);
    marker.stroke({ color: 0xd9f1ff, width: 1.5, alpha: 0.56 + ageRatio * 0.3, cap: "round" });
  } else {
    drawBombExplosionEventCue(marker, point.x, point.y, eventAgeSeconds);
    marker.circle(point.x, point.y, 5.8 + ageRatio * 1.05);
    marker.fill({ color: 0xffb25a, alpha: 0.14 + ageRatio * 0.16 });
    marker.moveTo(point.x - 3.7, point.y - 3.7);
    marker.lineTo(point.x + 3.7, point.y + 3.7);
    marker.moveTo(point.x + 3.7, point.y - 3.7);
    marker.lineTo(point.x - 3.7, point.y + 3.7);
    marker.stroke({ color: 0xffb25a, width: 1.9, alpha: 0.54 + ageRatio * 0.24, cap: "round" });
  }
  layer.addChild(marker);
}

function drawMapBombDamageCue(
  layer: Container,
  replay: Replay,
  worldX: number,
  worldY: number,
  eventAgeSeconds: number,
  radarViewport: RadarViewport,
  field: BombDamageField | null,
) {
  if (
    !field ||
    field.mapId !== replay.map.mapId ||
    !field.compatibleSourceDemoSha256.has(replay.sourceDemo.sha256.toLowerCase()) ||
    field.radarWidth !== radarViewport.imageWidth ||
    field.radarHeight !== radarViewport.imageHeight ||
    eventAgeSeconds < 0 ||
    eventAgeSeconds > FIELD_CUE_SECONDS
  ) {
    return;
  }

  const site = resolveBombDamageSite(field, worldX, worldY);
  if (!site) {
    return;
  }

  // The mask extent and wall-following shape come from the exact compiled map
  // resource identified by the field manifest. Opacity is only a short event
  // emphasis; it does not claim exact damage, arrival time, or player outcome.
  const attack = clamp(eventAgeSeconds / 0.16, 0, 1);
  const decay = 1 - clamp((eventAgeSeconds - 0.2) / (FIELD_CUE_SECONDS - 0.2), 0, 1);
  const sprite = new Sprite(site.texture);
  sprite.x = radarViewport.offsetX;
  sprite.y = radarViewport.offsetY;
  sprite.width = radarViewport.imageWidth * radarViewport.scale;
  sprite.height = radarViewport.imageHeight * radarViewport.scale;
  sprite.alpha = attack * decay * 0.42;
  sprite.tint = 0xff9c42;
  sprite.blendMode = "add";
  layer.addChild(sprite);
}
