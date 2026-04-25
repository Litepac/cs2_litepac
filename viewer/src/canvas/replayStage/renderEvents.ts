import { Container, Graphics, Text } from "pixi.js";

import type { RadarViewport } from "../../maps/transform";
import { worldToScreen } from "../../maps/transform";
import type { Replay, Round } from "../../replay/types";
import { HURT_BURST_GAP_TICKS, RECENT_HURT_WINDOW_TICKS } from "./constants";

const KILL_MARKER_CT_COLOR = 0x56b3ff;
const KILL_MARKER_T_COLOR = 0xf2a64b;
const KILL_MARKER_NEUTRAL_COLOR = 0xd8e1e8;

type HurtBurst = {
  armorDamageTaken: number;
  attackerPlayerId: string | null;
  attackerX: number | null;
  attackerY: number | null;
  count: number;
  firstTick: number;
  healthDamageTaken: number;
  lastTick: number;
  labelOffsetIndex: number;
  showDamageLabel: boolean;
  victimPlayerId: string | null;
  victimX: number | null;
  victimY: number | null;
  weaponName: string;
};

export function renderCombatOverlays(
  layer: Container,
  replay: Replay,
  round: Round,
  currentTick: number,
  radarViewport: RadarViewport,
) {
  for (const hurtBurst of buildVisibleHurtBursts(round, currentTick)) {
    drawHurtBurst(layer, replay, round, hurtBurst, currentTick, radarViewport);
  }

  for (const killEvent of round.killEvents) {
    drawKillEvent(layer, replay, round, killEvent, currentTick, radarViewport);
  }
}

function drawKillEvent(
  layer: Container,
  replay: Replay,
  round: Round,
  event: Round["killEvents"][number],
  currentTick: number,
  radarViewport: RadarViewport,
) {
  if (event.tick > currentTick) {
    return;
  }

  if (event.victimX == null || event.victimY == null) {
    return;
  }

  const side = resolvePlayerSide(round, event.victimPlayerId);
  const color =
    side === "CT" ? KILL_MARKER_CT_COLOR : side === "T" ? KILL_MARKER_T_COLOR : KILL_MARKER_NEUTRAL_COLOR;
  const point = worldToScreen(replay, radarViewport, event.victimX, event.victimY);
  const marker = new Graphics();
  marker.moveTo(point.x - 5.5, point.y - 5.5);
  marker.lineTo(point.x + 5.5, point.y + 5.5);
  marker.moveTo(point.x + 5.5, point.y - 5.5);
  marker.lineTo(point.x - 5.5, point.y + 5.5);
  marker.stroke({ color: 0x050b10, width: 3.2, alpha: 0.22, cap: "round", join: "round" });
  marker.moveTo(point.x - 5.5, point.y - 5.5);
  marker.lineTo(point.x + 5.5, point.y + 5.5);
  marker.moveTo(point.x + 5.5, point.y - 5.5);
  marker.lineTo(point.x - 5.5, point.y + 5.5);
  marker.stroke({ color, width: 1.65, alpha: 0.48, cap: "round", join: "round" });
  layer.addChild(marker);
}

function drawHurtBurst(
  layer: Container,
  replay: Replay,
  round: Round,
  event: HurtBurst,
  currentTick: number,
  radarViewport: RadarViewport,
) {
  if (event.lastTick > currentTick || currentTick - event.lastTick > RECENT_HURT_WINDOW_TICKS) {
    return;
  }

  if (event.attackerX == null || event.attackerY == null || event.victimX == null || event.victimY == null) {
    return;
  }

  const ageRatio = 1 - (currentTick - event.lastTick) / RECENT_HURT_WINDOW_TICKS;
  const attackerPoint = worldToScreen(replay, radarViewport, event.attackerX, event.attackerY);
  const victimPoint = worldToScreen(replay, radarViewport, event.victimX, event.victimY);
  const side = resolvePlayerSide(round, event.attackerPlayerId);
  const accentColor = side === "CT" ? 0x8ed1ff : side === "T" ? 0xffca78 : 0xffe2ad;
  const damageValue = event.healthDamageTaken > 0 ? event.healthDamageTaken : event.armorDamageTaken;
  const armorOnly = event.healthDamageTaken <= 0 && event.armorDamageTaken > 0;
  const isHEBurst = event.weaponName === "HE Grenade";
  const burstDurationTicks = Math.max(1, event.lastTick - event.firstTick + 1);
  const dx = victimPoint.x - attackerPoint.x;
  const dy = victimPoint.y - attackerPoint.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  if (distance < 8) {
    return;
  }
  const nx = dx / distance;
  const ny = dy / distance;
  const px = -ny;
  const py = nx;
  const labelNormalSign = py > 0 ? -1 : 1;
  const fade = Math.max(0, ageRatio);
  const burstStrength = Math.min(1.4, 1 + (event.count - 1) * 0.15 + Math.min(0.15, burstDurationTicks / 30));
  const attackerRadius = 10;
  const victimRadius = 10;
  const startX = attackerPoint.x + nx * attackerRadius;
  const startY = attackerPoint.y + ny * attackerRadius;
  const endX = victimPoint.x - nx * victimRadius;
  const endY = victimPoint.y - ny * victimRadius;
  const glowAlpha = isHEBurst ? 0.012 + fade * 0.025 : 0.035 + fade * 0.075;
  const lineAlpha = isHEBurst ? 0.024 + fade * 0.05 : 0.1 + fade * 0.18;
  const coreAlpha = isHEBurst ? 0.04 + fade * 0.08 : 0.16 + fade * 0.24;
  const labelSpread = 10 + Math.min(2, event.labelOffsetIndex) * 12;
  const labelRise = 3 + event.labelOffsetIndex * 9 + fade * 5;
  const labelX = endX + nx * 4 + px * labelNormalSign * labelSpread;
  const labelY = endY + py * labelNormalSign * labelSpread - labelRise;
  const impactRadius = isHEBurst
    ? 1.75 + burstStrength * 0.38 + fade * 0.4
    : 2.7 + burstStrength * 0.9 + fade * 0.9;

  const marker = new Graphics();
  if (!isHEBurst) {
    marker.moveTo(startX, startY);
    marker.lineTo(endX, endY);
    marker.stroke({ cap: "round", color: accentColor, join: "round", width: 2.2 * burstStrength, alpha: glowAlpha });
    marker.moveTo(startX, startY);
    marker.lineTo(endX, endY);
    marker.stroke({ cap: "round", color: accentColor, join: "round", width: 1.3, alpha: lineAlpha });
    marker.moveTo(startX, startY);
    marker.lineTo(endX, endY);
    marker.stroke({ cap: "round", color: 0xfff1cf, join: "round", width: 0.65, alpha: coreAlpha });
  }
  marker.circle(endX, endY, impactRadius);
  marker.stroke({
    color: accentColor,
    width: isHEBurst ? 0.8 : 0.95,
    alpha: isHEBurst ? 0.08 + fade * 0.1 : 0.12 + fade * 0.18,
  });
  marker.circle(endX, endY, isHEBurst ? 1.05 + fade * 0.24 : 1.35 + fade * 0.45);
  marker.fill({
    color: armorOnly ? 0xb8daff : 0xfff1cf,
    alpha: isHEBurst ? 0.12 + fade * 0.1 : 0.18 + fade * 0.16,
  });
  layer.addChild(marker);

  if (damageValue > 0 && event.showDamageLabel) {
    const damageText = new Text({
      text: armorOnly ? `${damageValue}A` : `${damageValue}`,
      style: {
        fill: armorOnly ? 0xb8daff : 0xf3f5f8,
        fontFamily: "IBM Plex Sans, Segoe UI, sans-serif",
        fontSize: event.count > 1 ? 13 : 12,
        fontWeight: "700",
        stroke: { color: 0x0a1218, width: 3, join: "round" },
      },
    });
    damageText.anchor.set(0.5, 1);
    damageText.roundPixels = true;
    damageText.resolution = 2;
    damageText.position.set(labelX, labelY);
    damageText.alpha = 0.46 + fade * 0.32;
    layer.addChild(damageText);
  }
}

function buildVisibleHurtBursts(round: Round, currentTick: number) {
  const bursts: HurtBurst[] = [];
  const activeBursts = new Map<string, HurtBurst>();

  for (const event of round.hurtEvents) {
    if (event.tick > currentTick || currentTick - event.tick > RECENT_HURT_WINDOW_TICKS) {
      continue;
    }

    const key = `${event.attackerPlayerId ?? "unknown"}:${event.victimPlayerId ?? "unknown"}:${event.weaponName}`;
    const previous = activeBursts.get(key);
    if (previous && event.tick - previous.lastTick <= HURT_BURST_GAP_TICKS) {
      previous.lastTick = event.tick;
      previous.count += 1;
      previous.healthDamageTaken += event.healthDamageTaken;
      previous.armorDamageTaken += event.armorDamageTaken;
      previous.attackerX = event.attackerX;
      previous.attackerY = event.attackerY;
      previous.victimX = event.victimX;
      previous.victimY = event.victimY;
      continue;
    }

    const burst: HurtBurst = {
      armorDamageTaken: event.armorDamageTaken,
      attackerPlayerId: event.attackerPlayerId,
      attackerX: event.attackerX,
      attackerY: event.attackerY,
      count: 1,
      firstTick: event.tick,
      healthDamageTaken: event.healthDamageTaken,
      lastTick: event.tick,
      labelOffsetIndex: 0,
      showDamageLabel: true,
      victimPlayerId: event.victimPlayerId,
      victimX: event.victimX,
      victimY: event.victimY,
      weaponName: event.weaponName,
    };
    bursts.push(burst);
    activeBursts.set(key, burst);
  }

  const sortedBursts = bursts.sort((left, right) => left.lastTick - right.lastTick);
  const victimBurstCounts = new Map<string, number>();

  for (let index = sortedBursts.length - 1; index >= 0; index -= 1) {
    const burst = sortedBursts[index];
    const victimKey = burst.victimPlayerId ?? `victim:${burst.victimX ?? "x"}:${burst.victimY ?? "y"}`;
    const visibleCount = victimBurstCounts.get(victimKey) ?? 0;
    burst.labelOffsetIndex = visibleCount;
    burst.showDamageLabel = visibleCount < 2;
    victimBurstCounts.set(victimKey, visibleCount + 1);
  }

  return sortedBursts;
}

function resolvePlayerSide(round: Round, playerId: string | null) {
  if (!playerId) {
    return null;
  }

  return round.playerStreams.find((stream) => stream.playerId === playerId)?.side ?? null;
}
