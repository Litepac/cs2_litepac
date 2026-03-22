import { Container, Graphics, Text } from "pixi.js";

import type { RadarViewport } from "../../maps/transform";
import { worldToScreen } from "../../maps/transform";
import type { Replay, Round } from "../../replay/types";
import { resolvePlayerEquipmentState, type PlayerTokenMode, type UtilityKind, type WeaponClass } from "../../replay/weapons";
import { RECENT_UTILITY_THROW_MODE_SECONDS } from "./constants";
import type { BlindEffectState } from "./types";
import { clamp } from "./camera";

type InterpolatedPlayerSample = {
  alive: boolean;
  hasBomb: boolean;
  health: number | null;
  activeWeapon: string | null;
  activeWeaponClass: WeaponClass | null;
  mainWeapon: string | null;
  x: number | null;
  y: number | null;
  yaw: number | null;
};

type LivePlayerEntry = {
  hasBomb: boolean;
  player: Replay["players"][number];
  point: { x: number; y: number };
  selected: boolean;
  side: "T" | "CT" | null;
};

export function renderPlayers(
  playerLayer: Container,
  eventLayer: Container,
  replay: Replay,
  round: Round,
  currentTick: number,
  radarViewport: RadarViewport,
  selectedPlayerId: string | null,
  playerById: Map<string, Replay["players"][number]>,
  onSelectPlayer: (playerId: string) => void,
) {
  const blindEffects = buildActiveBlindEffects(round, currentTick, replay.match.tickRate);
  const livePlayers: LivePlayerEntry[] = [];

  for (const stream of round.playerStreams) {
    const sample = interpolatePlayerSample(stream, currentTick);
    if (!sample) {
      continue;
    }

    const { alive, hasBomb, x, y } = sample;
    if (!alive || x == null || y == null) {
      continue;
    }

    const player = playerById.get(stream.playerId);
    if (!player) {
      continue;
    }

    const point = worldToScreen(replay, radarViewport, x, y);
    const selected = selectedPlayerId === stream.playerId;
    const recentUtilityThrow = hasRecentUtilityThrow(round, stream.playerId, currentTick, replay.match.tickRate);
    const equipment = resolvePlayerEquipmentState({
      activeWeapon: sample.activeWeapon,
      activeWeaponClass: sample.activeWeaponClass,
      mainWeapon: sample.mainWeapon,
      recentUtilityThrow,
    });

    const marker = new Graphics();
    marker.eventMode = "static";
    marker.cursor = "pointer";
    marker.on("pointertap", () => onSelectPlayer(stream.playerId));

    drawPlayerMarker(
      marker,
      point.x,
      point.y,
      stream.side,
      selected,
      sample.yaw,
      sample.health,
      equipment.tokenMode,
      equipment.activeUtilityKind,
      blindEffects.get(stream.playerId) ?? null,
    );

    if (hasBomb) {
      marker.roundRect(point.x + 9, point.y - 13, 9, 9, 2);
      marker.fill({ color: 0x15100a, alpha: 0.94 });
      marker.stroke({ color: 0xffd06c, width: 1.4, alpha: 0.9 });
      marker.rect(point.x + 11.5, point.y - 10.5, 4, 4);
      marker.stroke({ color: 0xffd06c, width: 1.2, alpha: 0.92 });
    }

    playerLayer.addChild(marker);
    livePlayers.push({
      hasBomb,
      player,
      point,
      selected,
      side: stream.side,
    });
  }

  drawPlayerLabels(eventLayer, livePlayers);
}

function interpolatePlayerSample(
  stream: Round["playerStreams"][number],
  currentTick: number,
): InterpolatedPlayerSample | null {
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
  if (left == null && right == null) {
    return null;
  }

  if (left == null) {
    return right;
  }

  if (right == null) {
    return left;
  }

  const delta = ((((right - left) % 360) + 540) % 360) - 180;
  return left + delta * mix;
}

function drawPlayerLabel(
  layer: Container,
  labelX: number,
  labelY: number,
  displayName: string,
  selected: boolean,
  side: "T" | "CT" | null,
  hasBomb: boolean,
) {
  const text = new Text({
    text: displayName,
    style: {
      fill: 0xf2f4f8,
      fontFamily: "IBM Plex Sans, Segoe UI, sans-serif",
      fontSize: selected ? 9 : 8,
      fontWeight: selected ? "700" : "600",
      letterSpacing: 0.15,
    },
  });
  text.roundPixels = true;
  text.resolution = 2.5;

  const paddingX = selected ? 6 : 5;
  const paddingY = 1.5;
  const labelWidth = text.width + paddingX * 2;
  const labelHeight = text.height + paddingY * 2;

  const background = new Graphics();
  background.roundRect(labelX, labelY, labelWidth, labelHeight, 2);
  background.fill({ color: selected ? 0x121a22 : 0x0b1117, alpha: selected ? 0.95 : 0.86 });
  background.stroke({
    color:
      hasBomb ? 0xffc56d : side === "CT" ? 0x3f95d4 : side === "T" ? 0xd68c2c : 0x2c3c49,
    width: 1,
    alpha: 0.9,
  });
  layer.addChild(background);

  text.x = Math.round(labelX + paddingX);
  text.y = Math.round(labelY + paddingY - 1);
  layer.addChild(text);
}

function drawPlayerMarker(
  marker: Graphics,
  x: number,
  y: number,
  side: "T" | "CT" | null,
  selected: boolean,
  yaw: number | null,
  health: number | null,
  mode: PlayerTokenMode,
  activeUtilityKind: UtilityKind | null,
  blindEffect: BlindEffectState | null,
) {
  const fillColor = side === "CT" ? 0x3fa8ff : 0xf3a448;
  const strokeColor = selected ? 0xf6fbff : 0x091116;
  const radius = selected ? 9 : 7;
  const healthRatio = health == null ? 1 : clamp(health / 100, 0, 1);
  const innerRadius = Math.max(1.9, radius - 1.7);

  marker.circle(x, y, radius);
  marker.fill({ color: fillColor, alpha: selected ? 1 : 0.96 });
  marker.stroke({ color: strokeColor, width: selected ? 1.08 : 0.94, alpha: 0.97 });

  drawBlindedRing(marker, x, y, radius, selected, blindEffect);

  const healthMask = new Graphics();
  healthMask.circle(x, y, innerRadius);
  healthMask.fill({ color: 0xffffff, alpha: 1 });
  healthMask.alpha = 0;
  marker.addChild(healthMask);

  const healthLossHeight = innerRadius * 2 * (1 - healthRatio);
  if (healthLossHeight > 0.01) {
    const shade = new Graphics();
    shade.rect(x - innerRadius - 1, y - innerRadius - 1, innerRadius * 2 + 2, healthLossHeight + 1);
    shade.fill({ color: 0x081017, alpha: 0.8 });
    shade.mask = healthMask;
    marker.addChild(shade);
  }

  const innerOutline = new Graphics();
  innerOutline.circle(x, y, innerRadius);
  innerOutline.stroke({ color: 0x0a1117, width: selected ? 0.52 : 0.44, alpha: 0.22 });
  marker.addChild(innerOutline);

  drawPlayerTokenMode(marker, x, y, yaw, radius, fillColor, strokeColor, selected, mode, activeUtilityKind);
}

function drawBlindedRing(
  marker: Graphics,
  x: number,
  y: number,
  radius: number,
  selected: boolean,
  blindEffect: BlindEffectState | null,
) {
  if (blindEffect == null) {
    return;
  }

  const remainingRatio = blindEffect.progress;
  const severityRatio = blindEffect.severity;
  const ringRadius = radius + (selected ? 3.15 : 2.85);
  const ringWidth = selected ? 2.15 : 1.85;

  marker.circle(x, y, ringRadius);
  marker.stroke({
    color: 0xf6fbff,
    width: Math.max(0.8, ringWidth - 1.1),
    alpha: 0.06 + severityRatio * 0.16,
  });

  drawArcStroke(marker, x, y, ringRadius, -Math.PI / 2, -Math.PI / 2 + remainingRatio * Math.PI * 2);
  marker.stroke({
    color: 0xffffff,
    width: ringWidth,
    alpha: 0.28 + severityRatio * 0.46,
    cap: "round",
  });

  if (severityRatio > 0.42) {
    marker.circle(x, y, ringRadius + 0.75);
    marker.stroke({
      color: 0xffffff,
      width: 0.64,
      alpha: 0.03 + severityRatio * 0.07,
    });
  }
}

function drawPlayerTokenMode(
  marker: Graphics,
  x: number,
  y: number,
  yaw: number | null,
  radius: number,
  fillColor: number,
  strokeColor: number,
  selected: boolean,
  mode: PlayerTokenMode,
  activeUtilityKind: UtilityKind | null,
) {
  if (mode === "utility") {
    const badgeX = x + radius * 0.84;
    const badgeY = y + radius * 0.66;
    drawHeldUtilityTokenMarker(marker, badgeX, badgeY, fillColor, strokeColor, selected, activeUtilityKind);

    if (yaw == null) {
      return;
    }

    const radians = (yaw * Math.PI) / 180;
    const forwardX = Math.cos(radians);
    const forwardY = -Math.sin(radians);
    const dotRadius = selected ? 2.02 : 1.78;
    const dotDistance = radius + dotRadius + 1.05;
    const dotX = x + forwardX * dotDistance;
    const dotY = y + forwardY * dotDistance;
    marker.circle(dotX, dotY, dotRadius);
    marker.fill({ color: fillColor, alpha: 0.98 });
    marker.stroke({ color: strokeColor, width: selected ? 0.72 : 0.62, alpha: 0.95 });
    return;
  }

  if (yaw == null) {
    return;
  }

  const radians = (yaw * Math.PI) / 180;
  const forwardX = Math.cos(radians);
  const forwardY = -Math.sin(radians);
  const normalX = Math.cos(radians + Math.PI / 2);
  const normalY = -Math.sin(radians + Math.PI / 2);
  const baseDistance = radius - 1.15;
  const baseX = x + forwardX * baseDistance;
  const baseY = y + forwardY * baseDistance;

  if (mode === "knife") {
    const tipDistance = radius + (selected ? 5.6 : 4.9);
    const halfWidth = selected ? 3.1 : 2.7;
    const tipX = x + forwardX * tipDistance;
    const tipY = y + forwardY * tipDistance;
    marker.moveTo(baseX + normalX * halfWidth, baseY + normalY * halfWidth);
    marker.lineTo(baseX - normalX * halfWidth, baseY - normalY * halfWidth);
    marker.lineTo(tipX, tipY);
    marker.closePath();
    marker.fill({ color: fillColor, alpha: 0.98 });
    marker.moveTo(baseX + normalX * halfWidth, baseY + normalY * halfWidth);
    marker.lineTo(tipX, tipY);
    marker.lineTo(baseX - normalX * halfWidth, baseY - normalY * halfWidth);
    marker.stroke({ color: strokeColor, width: selected ? 0.74 : 0.64, alpha: 0.95, cap: "round", join: "round" });
    return;
  }

  const tailLength =
    mode === "awp"
      ? selected
        ? 10.9
        : 9.8
      : mode === "rifle"
        ? selected
          ? 6.85
          : 6.05
        : selected
          ? 2.35
          : 1.95;
  const tailHalfWidth =
    mode === "awp"
      ? selected
        ? 1.88
        : 1.72
      : mode === "rifle"
        ? selected
          ? 1.56
          : 1.42
        : selected
          ? 1.16
          : 1.04;
  const tailInset = mode === "awp" ? 0.46 : mode === "rifle" ? 0.34 : 0.24;
  const neckWidth =
    mode === "awp" ? tailHalfWidth + 0.26 : mode === "rifle" ? tailHalfWidth + 0.18 : tailHalfWidth + 0.12;
  drawPlayerTokenTail(
    marker,
    baseX,
    baseY,
    forwardX,
    forwardY,
    normalX,
    normalY,
    tailLength + 1.15,
    neckWidth,
    tailHalfWidth - tailInset,
    fillColor,
    strokeColor,
    selected ? 0.74 : 0.64,
  );
}

function drawPlayerTokenTail(
  marker: Graphics,
  baseX: number,
  baseY: number,
  forwardX: number,
  forwardY: number,
  normalX: number,
  normalY: number,
  tipDistance: number,
  baseHalfWidth: number,
  tipHalfWidth: number,
  fillColor: number,
  strokeColor: number,
  strokeWidth: number,
) {
  const topBaseX = baseX + normalX * baseHalfWidth;
  const topBaseY = baseY + normalY * baseHalfWidth;
  const bottomBaseX = baseX - normalX * baseHalfWidth;
  const bottomBaseY = baseY - normalY * baseHalfWidth;
  const tipX = baseX + forwardX * tipDistance;
  const tipY = baseY + forwardY * tipDistance;
  const topTipX = tipX + normalX * tipHalfWidth;
  const topTipY = tipY + normalY * tipHalfWidth;
  const bottomTipX = tipX - normalX * tipHalfWidth;
  const bottomTipY = tipY - normalY * tipHalfWidth;

  marker.moveTo(topBaseX, topBaseY);
  marker.lineTo(bottomBaseX, bottomBaseY);
  marker.lineTo(bottomTipX, bottomTipY);
  marker.lineTo(topTipX, topTipY);
  marker.closePath();
  marker.fill({ color: fillColor, alpha: 0.98 });
  marker.moveTo(topBaseX, topBaseY);
  marker.lineTo(topTipX, topTipY);
  marker.lineTo(bottomTipX, bottomTipY);
  marker.lineTo(bottomBaseX, bottomBaseY);
  marker.stroke({ color: strokeColor, width: strokeWidth, alpha: 0.95, cap: "round", join: "round" });
}

function drawHeldUtilityTokenMarker(
  marker: Graphics,
  x: number,
  y: number,
  fillColor: number,
  strokeColor: number,
  selected: boolean,
  utilityKind: UtilityKind | null,
) {
  const badge = new Graphics();
  badge.x = x;
  badge.y = y;
  badge.scale.set(selected ? 0.76 : 0.7);
  marker.addChild(badge);

  if (!utilityKind) {
    const fallbackRadius = selected ? 1.8 : 1.6;
    badge.circle(0, 0, fallbackRadius);
    badge.fill({ color: fillColor, alpha: 0.98 });
    badge.stroke({ color: strokeColor, width: selected ? 0.72 : 0.62, alpha: 0.95 });
    return;
  }

  switch (utilityKind) {
    case "smoke":
      drawSmokeTokenUtility(badge, 0, 0, fillColor, strokeColor, selected);
      return;
    case "flashbang":
      drawFlashTokenUtility(badge, 0, 0, fillColor, strokeColor, selected);
      return;
    case "hegrenade":
      drawHETokenUtility(badge, 0, 0, fillColor, strokeColor, selected);
      return;
    case "molotov":
    case "incendiary":
      drawFireTokenUtility(badge, 0, 0, fillColor, strokeColor, selected);
      return;
    case "decoy":
      drawDecoyTokenUtility(badge, 0, 0, fillColor, strokeColor, selected);
      return;
    default:
      badge.circle(0, 0, selected ? 1.8 : 1.6);
      badge.fill({ color: fillColor, alpha: 0.98 });
      badge.stroke({ color: strokeColor, width: selected ? 0.72 : 0.62, alpha: 0.95 });
  }
}

function fillAndStrokeTokenShape(
  marker: Graphics,
  drawShape: () => void,
  fillColor: number,
  strokeColor: number,
  strokeWidth: number,
) {
  drawShape();
  marker.fill({ color: fillColor, alpha: 0.98 });
  drawShape();
  marker.stroke({ color: strokeColor, width: strokeWidth, alpha: 0.96, cap: "round", join: "round" });
}

function drawFlashTokenUtility(
  marker: Graphics,
  x: number,
  y: number,
  fillColor: number,
  strokeColor: number,
  selected: boolean,
) {
  const strokeWidth = selected ? 0.84 : 0.76;
  fillAndStrokeTokenShape(
    marker,
    () => marker.roundRect(x - 1.85, y - 3.65, 3.7, 7.2, 0.88),
    fillColor,
    strokeColor,
    strokeWidth,
  );
  fillAndStrokeTokenShape(
    marker,
    () => marker.rect(x - 0.95, y - 4.75, 1.9, 1.02),
    fillColor,
    strokeColor,
    selected ? 0.7 : 0.64,
  );
  marker.moveTo(x + 0.95, y - 4.35);
  marker.lineTo(x + 1.75, y - 4.35);
  marker.lineTo(x + 1.75, y - 3.15);
  marker.stroke({ color: strokeColor, width: selected ? 0.8 : 0.72, alpha: 0.95, cap: "round", join: "round" });
  marker.circle(x + 2.85, y - 4.05, selected ? 1.02 : 0.92);
  marker.stroke({ color: strokeColor, width: selected ? 0.84 : 0.76, alpha: 0.96 });
  marker.moveTo(x, y - 2.15);
  marker.lineTo(x, y + 2.0);
  marker.stroke({ color: strokeColor, width: selected ? 0.84 : 0.76, alpha: 0.72, cap: "round" });
}

function drawSmokeTokenUtility(
  marker: Graphics,
  x: number,
  y: number,
  fillColor: number,
  strokeColor: number,
  selected: boolean,
) {
  const strokeWidth = selected ? 0.86 : 0.78;
  fillAndStrokeTokenShape(
    marker,
    () => marker.roundRect(x - 2.2, y - 4.75, 4.4, 9.5, 0.96),
    fillColor,
    strokeColor,
    strokeWidth,
  );
  fillAndStrokeTokenShape(
    marker,
    () => marker.rect(x - 1.25, y - 6, 2.5, 1.05),
    fillColor,
    strokeColor,
    selected ? 0.72 : 0.66,
  );
  fillAndStrokeTokenShape(
    marker,
    () => marker.roundRect(x + 1.95, y - 2.65, 1.55, 5.2, 0.3),
    fillColor,
    strokeColor,
    selected ? 0.78 : 0.72,
  );
  marker.moveTo(x - 1.15, y - 2.95);
  marker.lineTo(x + 1.1, y - 2.95);
  marker.moveTo(x - 1.15, y - 1.0);
  marker.lineTo(x + 1.1, y - 1.0);
  marker.moveTo(x - 1.15, y + 0.95);
  marker.lineTo(x + 1.1, y + 0.95);
  marker.moveTo(x - 1.15, y + 2.9);
  marker.lineTo(x + 1.1, y + 2.9);
  marker.stroke({ color: strokeColor, width: selected ? 0.84 : 0.76, alpha: 0.74, cap: "round" });
}

function drawHETokenUtility(
  marker: Graphics,
  x: number,
  y: number,
  fillColor: number,
  strokeColor: number,
  selected: boolean,
) {
  fillAndStrokeTokenShape(
    marker,
    () => marker.circle(x - 0.15, y + 0.45, selected ? 3.2 : 2.9),
    fillColor,
    strokeColor,
    selected ? 0.88 : 0.8,
  );
  fillAndStrokeTokenShape(
    marker,
    () => marker.rect(x - 0.6, y - 3.95, 1.2, 1.2),
    fillColor,
    strokeColor,
    selected ? 0.72 : 0.66,
  );
  marker.moveTo(x + 1.0, y - 2.0);
  marker.lineTo(x + 2.65, y - 3.55);
  marker.stroke({ color: strokeColor, width: selected ? 0.8 : 0.72, alpha: 0.92, cap: "round" });
  marker.circle(x + 3.2, y - 3.8, selected ? 0.7 : 0.62);
  marker.stroke({ color: strokeColor, width: selected ? 0.72 : 0.64, alpha: 0.9 });
}

function drawFireTokenUtility(
  marker: Graphics,
  x: number,
  y: number,
  fillColor: number,
  strokeColor: number,
  selected: boolean,
) {
  fillAndStrokeTokenShape(
    marker,
    () => marker.roundRect(x - 2.0, y - 2.85, 4, 6.45, 0.88),
    fillColor,
    strokeColor,
    selected ? 0.84 : 0.76,
  );
  fillAndStrokeTokenShape(
    marker,
    () => marker.rect(x - 0.6, y - 4.95, 1.2, 2.05),
    fillColor,
    strokeColor,
    selected ? 0.74 : 0.66,
  );
  fillAndStrokeTokenShape(
    marker,
    () => {
      marker.moveTo(x - 1.3, y - 2.85);
      marker.lineTo(x - 0.6, y - 4.05);
      marker.lineTo(x + 0.6, y - 4.05);
      marker.lineTo(x + 1.3, y - 2.85);
      marker.closePath();
    },
    fillColor,
    strokeColor,
    selected ? 0.72 : 0.66,
  );
  marker.moveTo(x + 0.15, y - 5.2);
  marker.lineTo(x + 1.25, y - 6.45);
  marker.stroke({ color: strokeColor, width: selected ? 0.82 : 0.74, alpha: 0.92, cap: "round" });
}

function drawDecoyTokenUtility(
  marker: Graphics,
  x: number,
  y: number,
  fillColor: number,
  strokeColor: number,
  selected: boolean,
) {
  fillAndStrokeTokenShape(
    marker,
    () => marker.roundRect(x - 2.15, y - 2.15, 4.3, 4.3, 0.84),
    fillColor,
    strokeColor,
    selected ? 0.82 : 0.74,
  );
  marker.moveTo(x - 1.35, y);
  marker.lineTo(x + 1.35, y);
  marker.moveTo(x, y - 1.35);
  marker.lineTo(x, y + 1.35);
  marker.stroke({ color: strokeColor, width: selected ? 0.8 : 0.72, alpha: 0.72, cap: "round" });
}

function hasRecentUtilityThrow(round: Round, playerId: string, currentTick: number, tickRate: number) {
  const windowTicks = Math.max(4, Math.round(tickRate * RECENT_UTILITY_THROW_MODE_SECONDS));
  return round.utilityEntities.some(
    (utility) =>
      utility.throwerPlayerId === playerId &&
      currentTick >= utility.startTick &&
      currentTick - utility.startTick <= windowTicks,
  );
}

function buildActiveBlindEffects(round: Round, currentTick: number, tickRate: number) {
  const effects = new Map<string, BlindEffectState>();

  for (const event of round.blindEvents) {
    if (event.tick > currentTick || event.endTick <= currentTick || event.durationTicks <= 0) {
      continue;
    }

    const remainingTicks = event.endTick - currentTick;
    const progress = clamp(remainingTicks / event.durationTicks, 0, 1);
    const severity = clamp(event.durationTicks / Math.max(1, tickRate * 2.8), 0.18, 1);
    const existing = effects.get(event.playerId);

    if (
      !existing ||
      remainingTicks > existing.remainingTicks ||
      (remainingTicks === existing.remainingTicks && severity > existing.severity)
    ) {
      effects.set(event.playerId, {
        progress,
        severity,
        remainingTicks,
      });
    }
  }

  return effects;
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

function compactPlayerLabel(name: string, maxLength: number) {
  if (name.length <= maxLength) {
    return name;
  }

  return `${name.slice(0, Math.max(3, maxLength - 1))}...`;
}

function drawPlayerLabels(layer: Container, livePlayers: LivePlayerEntry[]) {
  const occupied: Array<{ bottom: number; left: number; right: number; top: number }> = [];
  const ordered = [...livePlayers].sort((left, right) => {
    if (left.selected !== right.selected) {
      return left.selected ? -1 : 1;
    }

    return left.point.y - right.point.y;
  });

  for (const entry of ordered) {
    const displayName = compactPlayerLabel(entry.player.displayName, entry.selected ? 12 : 9);
    const fontSize = entry.selected ? 9 : 8;
    const paddingX = entry.selected ? 6 : 5;
    const labelWidth = estimateLabelWidth(displayName, fontSize) + paddingX * 2;
    const labelHeight = fontSize + 6;
    const markerRadius = entry.selected ? 11 : 8;
    const positions = [
      {
        x: Math.round(entry.point.x - labelWidth / 2),
        y: Math.round(entry.point.y - markerRadius - labelHeight - 6),
      },
      {
        x: Math.round(entry.point.x - labelWidth / 2),
        y: Math.round(entry.point.y + markerRadius + 6),
      },
    ];
    if (entry.side === "T") {
      positions.reverse();
    }

    const placement =
      positions.find((candidate) => !intersectsAny(candidate.x, candidate.y, labelWidth, labelHeight, occupied)) ??
      (entry.selected ? positions[0] : null);

    if (!placement) {
      continue;
    }

    drawPlayerLabel(layer, placement.x, placement.y, displayName, entry.selected, entry.side, entry.hasBomb);
    occupied.push({
      bottom: placement.y + labelHeight,
      left: placement.x,
      right: placement.x + labelWidth,
      top: placement.y,
    });
  }
}

function estimateLabelWidth(label: string, fontSize: number) {
  return Math.max(24, Math.round(label.length * fontSize * 0.58));
}

function intersectsAny(
  x: number,
  y: number,
  width: number,
  height: number,
  occupied: Array<{ bottom: number; left: number; right: number; top: number }>,
) {
  return occupied.some((entry) => x < entry.right && x + width > entry.left && y < entry.bottom && y + height > entry.top);
}
