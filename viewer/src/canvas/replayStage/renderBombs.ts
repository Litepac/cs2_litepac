import { Container, Graphics } from "pixi.js";

import type { RadarViewport } from "../../maps/transform";
import { worldToScreen } from "../../maps/transform";
import type { Replay, Round } from "../../replay/types";
import { RECENT_BOMB_WINDOW_TICKS } from "./constants";
import { clamp } from "./camera";

type ActiveBombState = {
  defuseCompletionTick: number | null;
  defuseStartTick: number | null;
  explodeTick: number | null;
  plantedTick: number;
  x: number;
  y: number;
};

export function renderBombOverlays(
  layer: Container,
  replay: Replay,
  round: Round,
  currentTick: number,
  radarViewport: RadarViewport,
) {
  const bombState = resolveActiveBombState(replay, round, currentTick);
  if (bombState) {
    drawBombStateOverlay(layer, replay, bombState, currentTick, radarViewport);
  }

  for (const bombEvent of round.bombEvents) {
    drawBombEvent(layer, replay, bombEvent, currentTick, radarViewport);
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
  const outerRadius = 18.2;
  const trackRadius = outerRadius - 1.35;
  const trackWidth = 4.8;
  const baseRadius = 12.5;
  const ringStart = -Math.PI / 2;
  const ringEnd = ringStart + Math.PI * 2 - 0.012;
  marker.circle(point.x, point.y, outerRadius + 4.8);
  marker.fill({ color: 0x03080d, alpha: 0.12 });
  marker.circle(point.x, point.y, outerRadius + 1.2);
  marker.fill({ color: 0x08111a, alpha: 0.82 });
  marker.circle(point.x, point.y, outerRadius + 1.4);
  marker.stroke({ color: 0x182632, width: 1.35, alpha: 0.78 });
  drawArcStroke(marker, point.x, point.y, trackRadius, ringStart, ringEnd);
  marker.stroke({ color: 0x203041, width: trackWidth, alpha: 0.96, cap: "round" });
  drawArcStroke(marker, point.x, point.y, trackRadius, ringStart, ringEnd);
  marker.stroke({ color: 0x0c151f, width: trackWidth - 1.8, alpha: 0.92, cap: "round" });

  if (bombProgress != null) {
    const progressEnd = ringStart + bombProgress * Math.PI * 2;
    drawArcStroke(marker, point.x, point.y, trackRadius, ringStart, progressEnd);
    marker.stroke({
      color: countdownColor,
      width: trackWidth + 1.1,
      alpha: 0.14,
      cap: "round",
    });
    drawArcStroke(marker, point.x, point.y, trackRadius, ringStart, progressEnd);
    marker.stroke({
      color: countdownColor,
      width: trackWidth,
      alpha: 0.95,
      cap: "round",
    });
  }

  drawBombThresholdMarker(marker, point.x, point.y, trackRadius, trackWidth, bombTimeTotalSeconds, 10, 0xf0b55a);
  drawBombThresholdMarker(marker, point.x, point.y, trackRadius, trackWidth, bombTimeTotalSeconds, 5, 0xff6a62);

  if (state.defuseStartTick != null) {
    if (state.defuseCompletionTick != null && state.defuseCompletionTick > state.defuseStartTick) {
      const progress = clamp(
        (currentTick - state.defuseStartTick) / (state.defuseCompletionTick - state.defuseStartTick),
        0,
        1,
      );
      drawArcStroke(marker, point.x, point.y, outerRadius + 4, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
      marker.stroke({ color: 0x79c8ff, width: 3.6, alpha: 0.94, cap: "round" });
    } else {
      const sweepPulse = 0.5 + 0.5 * Math.sin((currentTick - state.defuseStartTick) / 8);
      const sweepStart = -Math.PI / 2 + sweepPulse * 0.5;
      drawArcStroke(marker, point.x, point.y, outerRadius + 4, sweepStart, sweepStart + Math.PI * 0.75);
      marker.stroke({ color: 0x79c8ff, width: 3.2, alpha: 0.9, cap: "round" });
    }
  }

  marker.circle(point.x, point.y, baseRadius);
  marker.fill({ color: 0x091015, alpha: 0.1 });
  marker.circle(point.x, point.y, 8.2);
  marker.fill({ color: 0x0e171f, alpha: 0.78 });
  marker.circle(point.x, point.y, 8.2);
  marker.stroke({ color: 0x344654, width: 0.8, alpha: 0.42 });
  marker.roundRect(point.x - 4.35, point.y - 6.15, 8.7, 12.3, 1.2);
  marker.fill({ color: 0xf16876, alpha: 0.98 });
  marker.roundRect(point.x - 4.35, point.y - 6.15, 8.7, 12.3, 1.2);
  marker.stroke({ color: 0x0b1217, width: 0.95, alpha: 0.98 });
  marker.roundRect(point.x - 2.35, point.y - 3.55, 4.7, 1.45, 0.28);
  marker.fill({ color: 0x0f171e, alpha: 0.98 });
  marker.roundRect(point.x - 2.45, point.y - 1.0, 4.9, 4.95, 0.45);
  marker.stroke({ color: 0x0f171e, width: 0.72, alpha: 0.98 });
  for (const keypadX of [-1.08, 0, 1.08]) {
    for (const keypadY of [0.12, 1.2, 2.28]) {
      marker.rect(point.x + keypadX - 0.26, point.y + keypadY - 0.26, 0.52, 0.52);
      marker.fill({ color: 0x0f171e, alpha: 0.98 });
    }
  }
  marker.moveTo(point.x - 1.35, point.y - 7.65);
  marker.lineTo(point.x - 1.35, point.y - 9.6);
  marker.lineTo(point.x + 2.15, point.y - 9.6);
  marker.stroke({ color: 0xffa2ae, width: 0.92, alpha: 0.96 });
  layer.addChild(marker);
}

function resolveActiveBombState(replay: Replay, round: Round, currentTick: number): ActiveBombState | null {
  const plantedEvents = round.bombEvents.filter((event) => event.type === "planted" && event.tick <= currentTick);
  const planted = plantedEvents[plantedEvents.length - 1];
  if (!planted || planted.x == null || planted.y == null) {
    return null;
  }

  const terminal = round.bombEvents.find(
    (event) => event.tick > planted.tick && ["defused", "exploded"].includes(event.type),
  );
  if (terminal && terminal.tick <= currentTick) {
    return null;
  }

  const bombFlowEvents = round.bombEvents.filter(
    (event) => event.tick > planted.tick && ["defuse_start", "defuse_abort", "defused"].includes(event.type),
  );

  let activeDefuseStart: Round["bombEvents"][number] | null = null;
  for (const event of bombFlowEvents) {
    if (event.tick > currentTick) {
      break;
    }

    if (event.type === "defuse_start") {
      activeDefuseStart = event;
      continue;
    }

    if (event.type === "defuse_abort" || event.type === "defused") {
      activeDefuseStart = null;
    }
  }

  let defuseCompletionTick: number | null = null;
  if (activeDefuseStart) {
    const nextBombFlow = bombFlowEvents.find((event) => event.tick > activeDefuseStart.tick);
    if (nextBombFlow?.type === "defused") {
      defuseCompletionTick = nextBombFlow.tick;
    }
  }

  const explodeEvent = round.bombEvents.find((event) => event.tick > planted.tick && event.type === "exploded");
  const explodeTick =
    replayBombExplodeTick(round, replay.match.tickRate, replay.match.bombTimeSeconds, planted.tick) ?? explodeEvent?.tick ?? null;

  return {
    defuseCompletionTick,
    defuseStartTick: activeDefuseStart?.tick ?? null,
    explodeTick,
    plantedTick: planted.tick,
    x: planted.x,
    y: planted.y,
  };
}

function replayBombExplodeTick(round: Round, tickRate: number, bombTimeSeconds: number | null, plantedTick: number) {
  if (bombTimeSeconds == null || !Number.isFinite(bombTimeSeconds) || bombTimeSeconds <= 0) {
    return null;
  }

  return plantedTick + Math.round(bombTimeSeconds * tickRate);
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
  const point = worldToScreen(replay, radarViewport, event.x, event.y);
  const marker = new Graphics();
  marker.circle(point.x, point.y, 11);
  marker.fill({ color: 0x081017, alpha: 0.56 + ageRatio * 0.22 });
  if (event.type === "defused") {
    marker.circle(point.x, point.y, 8);
    marker.stroke({ color: 0x79c8ff, width: 2.2, alpha: 0.5 + ageRatio * 0.35 });
    marker.moveTo(point.x - 3.5, point.y);
    marker.lineTo(point.x + 3.5, point.y);
    marker.moveTo(point.x, point.y - 3.5);
    marker.lineTo(point.x, point.y + 3.5);
    marker.stroke({ color: 0xd9f1ff, width: 1.6, alpha: 0.58 + ageRatio * 0.32, cap: "round" });
  } else {
    marker.circle(point.x, point.y, 6.5 + ageRatio * 1.2);
    marker.fill({ color: 0xffb25a, alpha: 0.16 + ageRatio * 0.18 });
    marker.moveTo(point.x - 4, point.y - 4);
    marker.lineTo(point.x + 4, point.y + 4);
    marker.moveTo(point.x + 4, point.y - 4);
    marker.lineTo(point.x - 4, point.y + 4);
    marker.stroke({ color: 0xffb25a, width: 2, alpha: 0.56 + ageRatio * 0.26, cap: "round" });
  }
  layer.addChild(marker);
}
