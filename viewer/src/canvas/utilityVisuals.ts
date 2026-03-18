import { Container, Graphics, Text } from "pixi.js";

import type { RadarViewport } from "../maps/transform";
import { worldToScreen } from "../maps/transform";
import type { Replay, UtilityEntity } from "../replay/types";
import { utilityLifecycleEndTick, utilitySceneStateAtTick, type UtilitySceneState } from "../replay/utility";

type ScreenPoint = {
  x: number;
  y: number;
};

type UtilityDisplayPoint = {
  point: ScreenPoint;
  sampleIndex: number | null;
  source: "phase" | "trajectory";
};

type UtilityPhase = "projectile" | "active" | "burst";

export function drawUtilityVisual(
  _trailLayer: Container,
  overlayLayer: Container,
  replay: Replay,
  utility: UtilityEntity,
  throwerSide: "T" | "CT" | null,
  _throwerLabel: string | null,
  currentTick: number,
  radarViewport: RadarViewport,
  tickRate: number,
) {
  if (utility.kind === "smoke") {
      drawSmokeUtilityVisual(
      _trailLayer,
      overlayLayer,
      replay,
      utility,
      throwerSide,
      _throwerLabel,
      currentTick,
      radarViewport,
      tickRate,
    );
    return;
  }

  if (currentTick < utility.startTick) {
    return;
  }

  const state = utilitySceneStateAtTick(utility, currentTick, tickRate);
  if (!state) {
    return;
  }

  const renderPhase: UtilityPhase = state.phase;
  const displayPoint = utilityDisplayPoint(replay, utility, currentTick, radarViewport, renderPhase);
  const point = displayPoint?.point ?? null;

  if (!point) {
    return;
  }

  if (!point) {
    return;
  }

  if (renderPhase === "burst") {
    if (utility.kind === "flashbang") {
      drawFlashBurstVisual(overlayLayer, point, state?.burstAgeTicks ?? 0);
      return;
    }

    if (utility.kind === "hegrenade") {
      drawHEBurstVisual(overlayLayer, point, state?.burstAgeTicks ?? 0);
      return;
    }
  }

  if (renderPhase === "active") {
    if (utility.kind === "molotov" || utility.kind === "incendiary") {
      drawFireVisual(overlayLayer, point, state?.remainingSeconds ?? null);
      return;
    }

    if (utility.kind === "decoy") {
      drawDecoyVisual(overlayLayer, point, state?.remainingSeconds ?? null);
      return;
    }
  }

  drawProjectileVisual(overlayLayer, point, utility.kind);
}

function drawSmokeUtilityVisual(
  _trailLayer: Container,
  overlayLayer: Container,
  replay: Replay,
  utility: UtilityEntity,
  throwerSide: "T" | "CT" | null,
  _throwerLabel: string | null,
  currentTick: number,
  radarViewport: RadarViewport,
  tickRate: number,
) {
  if (currentTick < utility.startTick) {
    return;
  }

  const detonateTick = resolveSmokeDetonationTick(utility);
  const endTick = utility.endTick ?? detonateTick ?? utility.startTick;
  if (currentTick > endTick) {
    return;
  }

  const projectile = detonateTick == null || currentTick < detonateTick;
  const state: UtilitySceneState = {
    activeStartTick: detonateTick,
    burstAgeTicks: null,
    endTick,
    phase: projectile ? "projectile" : "active",
    remainingSeconds:
      projectile ? null : Math.max(0, (endTick - currentTick) / Math.max(1, tickRate)),
  };

  if (projectile) {
    const projectilePoint = utilityPointAtTick(replay, utility, currentTick, radarViewport, false);
    const point = projectilePoint?.point ?? null;
    if (!point) {
      return;
    }

    drawProjectileVisual(overlayLayer, point, utility.kind);
    return;
  }

  const activePoint = resolveSmokeActivePoint(replay, utility, radarViewport, detonateTick);
  if (!activePoint) {
    return;
  }

  drawSmokeVisual(overlayLayer, activePoint, state.remainingSeconds, currentTick, throwerSide);
}

function drawSmokeVisual(
  layer: Container,
  point: ScreenPoint,
  remainingSeconds: number | null,
  currentTick: number,
  throwerSide: "T" | "CT" | null,
) {
  const cloud = new Graphics();
  const pulse = 0.95 + ((Math.sin(currentTick / 16) + 1) / 2) * 0.08;
  const ringColor = throwerSide === "CT" ? 0x3fa8ff : throwerSide === "T" ? 0xf3a448 : 0xe8edf2;
  const puffs = [
    { dx: -16, dy: 5, radius: 13, alpha: 0.18 },
    { dx: -7, dy: -11, radius: 15, alpha: 0.2 },
    { dx: 7, dy: -9, radius: 14, alpha: 0.2 },
    { dx: 15, dy: 4, radius: 12, alpha: 0.17 },
    { dx: 10, dy: 14, radius: 11, alpha: 0.16 },
    { dx: -12, dy: 14, radius: 11, alpha: 0.15 },
    { dx: 0, dy: 2, radius: 18, alpha: 0.18 },
  ];

  for (const puff of puffs) {
    cloud.circle(point.x + puff.dx, point.y + puff.dy, puff.radius * pulse);
    cloud.fill({ color: 0xe7edf3, alpha: puff.alpha });
  }

  cloud.circle(point.x, point.y, 24 * pulse);
  cloud.fill({ color: 0xdbe4ec, alpha: 0.1 });
  layer.addChild(cloud);

  if (remainingSeconds != null) {
    const ring = new Graphics();
    const progress = Math.max(0, Math.min(1, remainingSeconds / 20));
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + Math.PI * 2 * progress;
    const startX = point.x + Math.cos(startAngle) * 19;
    const startY = point.y + Math.sin(startAngle) * 19;
    ring.moveTo(startX, startY);
    ring.arc(
      point.x,
      point.y,
      19,
      startAngle,
      endAngle,
    );
    ring.stroke({ color: ringColor, width: 3.2, alpha: 0.9 });
    layer.addChild(ring);
  }
}

function drawFireVisual(layer: Container, point: ScreenPoint, remainingSeconds: number | null) {
  const flame = new Graphics();
  const embers = [
    { dx: -12, dy: 2, radius: 8, alpha: 0.32, color: 0xff7a33 },
    { dx: -6, dy: -9, radius: 8, alpha: 0.3, color: 0xffa142 },
    { dx: 3, dy: -11, radius: 8, alpha: 0.28, color: 0xffbf5f },
    { dx: 11, dy: -4, radius: 7, alpha: 0.26, color: 0xff9c42 },
    { dx: 10, dy: 7, radius: 8, alpha: 0.24, color: 0xffbf5f },
    { dx: -2, dy: 10, radius: 8, alpha: 0.24, color: 0xff8f3f },
    { dx: -11, dy: 10, radius: 7, alpha: 0.22, color: 0xff6a2f },
  ];
  for (const ember of embers) {
    flame.circle(point.x + ember.dx, point.y + ember.dy, ember.radius);
    flame.fill({ color: ember.color, alpha: ember.alpha });
  }
  flame.circle(point.x, point.y, 18);
  flame.stroke({ color: 0xffb25a, width: 2.2, alpha: 0.52 });
  layer.addChild(flame);

  if (remainingSeconds != null) {
    const ring = new Graphics();
    const progress = Math.max(0, Math.min(1, remainingSeconds / 7));
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + Math.PI * 2 * progress;
    const startX = point.x + Math.cos(startAngle) * 18;
    const startY = point.y + Math.sin(startAngle) * 18;
    ring.moveTo(startX, startY);
    ring.arc(point.x, point.y, 18, startAngle, endAngle);
    ring.stroke({ color: 0xffb85c, width: 3, alpha: 0.88 });
    layer.addChild(ring);
  }
}

function drawDecoyVisual(layer: Container, point: ScreenPoint, remainingSeconds: number | null) {
  const decoy = new Graphics();
  decoy.circle(point.x, point.y, 16);
  decoy.fill({ color: 0x8158ff, alpha: 0.13 });
  decoy.circle(point.x, point.y, 15);
  decoy.stroke({ color: 0xbb9dff, width: 2, alpha: 0.5 });
  layer.addChild(decoy);

  drawTimerLabel(layer, point.x, point.y, remainingSeconds, {
    accentColor: 0xd0bfff,
    backgroundColor: 0x120c1f,
  });
}

function drawFlashBurstVisual(layer: Container, point: ScreenPoint, burstAgeTicks: number) {
  const alpha = 1 - burstAgeTicks / 10;
  const burst = new Graphics();
  burst.circle(point.x, point.y, 10 + burstAgeTicks * 1.8);
  burst.fill({ color: 0xfffdf1, alpha: 0.08 * alpha });
  burst.circle(point.x, point.y, 22 + burstAgeTicks * 2.2);
  burst.fill({ color: 0xfffdf1, alpha: 0.04 * alpha });
  burst.circle(point.x, point.y, 8 + burstAgeTicks * 1.15);
  burst.fill({ color: 0xfff9da, alpha: 0.2 * alpha });
  burst.circle(point.x, point.y, 11 + burstAgeTicks * 1.45);
  burst.stroke({ color: 0xfff4a8, width: 2.5, alpha: 0.56 * alpha });
  burst.circle(point.x, point.y, 16 + burstAgeTicks * 1.8);
  burst.stroke({ color: 0xfffdf1, width: 1.5, alpha: 0.24 * alpha });
  layer.addChild(burst);
}

function drawHEBurstVisual(layer: Container, point: ScreenPoint, burstAgeTicks: number) {
  const alpha = 1 - burstAgeTicks / 10;
  const burst = new Graphics();
  burst.circle(point.x, point.y, 7 + burstAgeTicks * 1.25);
  burst.stroke({ color: 0xff8a8a, width: 2.5, alpha: 0.58 * alpha });
  burst.circle(point.x, point.y, 3 + burstAgeTicks * 0.7);
  burst.fill({ color: 0xff6b6b, alpha: 0.26 * alpha });
  burst.circle(point.x, point.y, 13 + burstAgeTicks * 1.35);
  burst.stroke({ color: 0xffb0b0, width: 1.5, alpha: 0.2 * alpha });
  drawBurstParticle(burst, point.x - 11, point.y - 5, 2.1, 0xffb0b0, alpha * 0.4);
  drawBurstParticle(burst, point.x + 9, point.y + 7, 1.8, 0xff8a8a, alpha * 0.34);
  drawBurstParticle(burst, point.x - 4, point.y + 11, 1.6, 0xffd0d0, alpha * 0.3);
  drawBurstParticle(burst, point.x + 12, point.y - 3, 1.5, 0xffb0b0, alpha * 0.28);
  layer.addChild(burst);
}

function drawProjectileVisual(layer: Container, point: ScreenPoint, kind: UtilityEntity["kind"]) {
  const marker = new Graphics();

  switch (kind) {
    case "flashbang":
      marker.circle(point.x, point.y, 8);
      marker.fill({ color: 0xfff7b8, alpha: 0.2 });
      marker.circle(point.x, point.y, 6);
      marker.fill({ color: 0xfaf089, alpha: 0.92 });
      marker.moveTo(point.x - 7, point.y);
      marker.lineTo(point.x + 7, point.y);
      marker.moveTo(point.x, point.y - 7);
      marker.lineTo(point.x, point.y + 7);
      marker.stroke({ color: 0xfff9dc, width: 1.5, alpha: 0.8 });
      break;
    case "hegrenade":
      marker.circle(point.x, point.y, 8);
      marker.fill({ color: 0xff6b6b, alpha: 0.15 });
      marker.circle(point.x, point.y, 5.8);
      marker.fill({ color: 0x77838f, alpha: 0.95 });
      marker.moveTo(point.x - 2.5, point.y - 5.5);
      marker.lineTo(point.x + 2.8, point.y - 5.5);
      marker.stroke({ color: 0xe5edf4, width: 1.2, alpha: 0.9 });
      marker.moveTo(point.x + 3.2, point.y - 5.2);
      marker.lineTo(point.x + 5.4, point.y - 7.4);
      marker.stroke({ color: 0xe5edf4, width: 1.1, alpha: 0.9 });
      break;
    case "decoy":
      marker.roundRect(point.x - 6, point.y - 6, 12, 12, 4);
      marker.fill({ color: 0x9a6bff, alpha: 0.88 });
      marker.circle(point.x, point.y, 10);
      marker.stroke({ color: 0xcdb8ff, width: 1.5, alpha: 0.35 });
      break;
    case "smoke":
      marker.circle(point.x, point.y, 8.5);
      marker.fill({ color: 0xced8e1, alpha: 0.12 });
      marker.roundRect(point.x - 3.6, point.y - 5.2, 7.2, 10.2, 2.4);
      marker.fill({ color: 0xe4e8ed, alpha: 0.95 });
      marker.rect(point.x - 2.1, point.y - 7.7, 4.2, 2.6);
      marker.fill({ color: 0xaeb8c1, alpha: 0.95 });
      break;
    case "molotov":
    case "incendiary":
      marker.circle(point.x, point.y + 1, 9);
      marker.fill({ color: 0xff8f3f, alpha: 0.14 });
      marker.roundRect(point.x - 3.8, point.y - 6.5, 7.6, 13, 2.5);
      marker.fill({ color: 0xff9a45, alpha: 0.94 });
      marker.rect(point.x - 1.8, point.y - 9.2, 3.6, 3.2);
      marker.fill({ color: 0xffe0aa, alpha: 0.94 });
      break;
    default:
      marker.rect(point.x - 5, point.y - 5, 10, 10);
      marker.fill({ color: 0xffffff, alpha: 0.9 });
      break;
  }

  marker.stroke({ color: 0x081116, width: 2 });
  layer.addChild(marker);
}

function drawTimerLabel(
  layer: Container,
  x: number,
  y: number,
  remainingSeconds: number | null,
  options: { accentColor: number; backgroundColor: number },
) {
  if (remainingSeconds == null) {
    return;
  }

  const text = new Text({
    text: formatUtilityTimer(remainingSeconds),
    style: {
      fill: 0xf7fafc,
      fontFamily: "IBM Plex Sans, Segoe UI, sans-serif",
      fontSize: 11,
      fontWeight: "700",
    },
  });

  const paddingX = 7;
  const paddingY = 4;
  const labelWidth = text.width + paddingX * 2;
  const labelHeight = text.height + paddingY * 2;
  const labelX = x - labelWidth / 2;
  const labelY = y - labelHeight / 2 - 1;

  const background = new Graphics();
  background.roundRect(labelX, labelY, labelWidth, labelHeight, 8);
  background.fill({ color: options.backgroundColor, alpha: 0.88 });
  background.stroke({ color: options.accentColor, width: 1.5, alpha: 0.5 });
  layer.addChild(background);

  text.x = labelX + paddingX;
  text.y = labelY + paddingY - 1;
  layer.addChild(text);
}

function formatUtilityTimer(seconds: number) {
  const clamped = Math.max(0, seconds);
  return clamped >= 10 ? `${Math.ceil(clamped)}` : clamped.toFixed(1);
}

function drawBurstParticle(
  graphics: Graphics,
  x: number,
  y: number,
  radius: number,
  color: number,
  alpha: number,
) {
  graphics.circle(x, y, radius);
  graphics.fill({ color, alpha });
}

function interpolateTrajectorySampleAtTick(utility: UtilityEntity, currentTick: number) {
  const sampleInterval = Math.max(1, utility.trajectory.sampleIntervalTicks || 1);
  const relativeTick = currentTick - utility.trajectory.sampleOriginTick;
  const baseIndex = Math.floor(relativeTick / sampleInterval);
  if (baseIndex < 0 || baseIndex >= utility.trajectory.x.length - 1) {
    return null;
  }

  const mix = (relativeTick - baseIndex * sampleInterval) / sampleInterval;
  if (mix <= 0 || mix >= 1) {
    return null;
  }

  const leftX = utility.trajectory.x[baseIndex];
  const leftY = utility.trajectory.y[baseIndex];
  const rightX = utility.trajectory.x[baseIndex + 1];
  const rightY = utility.trajectory.y[baseIndex + 1];
  if (leftX == null || leftY == null || rightX == null || rightY == null) {
    return null;
  }

  return {
    tick: currentTick,
    x: leftX + (rightX - leftX) * mix,
    y: leftY + (rightY - leftY) * mix,
  };
}

function isWorldPointNearMap(replay: Replay, worldX: number, worldY: number) {
  const { worldXMin, worldXMax, worldYMin, worldYMax } = replay.map.coordinateSystem;
  const worldMarginX = (worldXMax - worldXMin) * 0.08;
  const worldMarginY = (worldYMax - worldYMin) * 0.08;
  return (
    worldX >= worldXMin - worldMarginX &&
    worldX <= worldXMax + worldMarginX &&
    worldY >= worldYMin - worldMarginY &&
    worldY <= worldYMax + worldMarginY
  );
}

function isScreenPointVisible(point: ScreenPoint, radarViewport: RadarViewport) {
  const margin = 24;
  return (
    point.x >= radarViewport.offsetX - margin &&
    point.x <= radarViewport.offsetX + radarViewport.imageWidth * radarViewport.scale + margin &&
    point.y >= radarViewport.offsetY - margin &&
    point.y <= radarViewport.offsetY + radarViewport.imageHeight * radarViewport.scale + margin
  );
}

function utilityPointAtTick(
  replay: Replay,
  utility: UtilityEntity,
  currentTick: number,
  radarViewport: RadarViewport,
  allowPhaseFallback = true,
): UtilityDisplayPoint | null {
  const sampleInterval = Math.max(1, utility.trajectory.sampleIntervalTicks || 1);
  const relativeTick = currentTick - utility.trajectory.sampleOriginTick;
  const sampleIndex = Math.floor(relativeTick / sampleInterval);
  const trajectoryPoint = resolveTrajectoryPointAtTick(replay, utility, currentTick, radarViewport, sampleIndex, sampleInterval);
  if (trajectoryPoint) {
    return trajectoryPoint;
  }

  if (!allowPhaseFallback) {
    return null;
  }

  const phase = [...utility.phaseEvents]
    .filter((event) => event.tick <= currentTick && event.x != null && event.y != null)
    .sort((a, b) => b.tick - a.tick)[0];

  if (!phase || phase.x == null || phase.y == null) {
    return null;
  }

  const point = worldToScreen(replay, radarViewport, phase.x, phase.y);
  return isScreenPointVisible(point, radarViewport)
    ? {
        point,
        sampleIndex: null,
        source: "phase",
      }
    : null;
}

function utilityDisplayPoint(
  replay: Replay,
  utility: UtilityEntity,
  currentTick: number,
  radarViewport: RadarViewport,
  renderPhase: UtilityPhase,
): UtilityDisplayPoint | null {
  const livePoint = utilityPointAtTick(
    replay,
    utility,
    currentTick,
    radarViewport,
    renderPhase !== "projectile",
  );
  if (livePoint) {
    return livePoint;
  }

  const lifecycleTick = utilityLifecycleEndTick(utility);
  const terminalTick = Math.min(currentTick, lifecycleTick);
  const finalPhase = [...utility.phaseEvents]
    .filter((event) => event.tick <= terminalTick && event.x != null && event.y != null)
    .sort((left, right) => right.tick - left.tick)[0];

  if (finalPhase?.x != null && finalPhase?.y != null) {
    const phasePoint = worldToScreen(replay, radarViewport, finalPhase.x, finalPhase.y);
    if (isScreenPointVisible(phasePoint, radarViewport)) {
      return {
        point: phasePoint,
        sampleIndex: null,
        source: "phase",
      };
    }
  }
  return null;
}

function resolveTrajectoryPointAtTick(
  replay: Replay,
  utility: UtilityEntity,
  currentTick: number,
  radarViewport: RadarViewport,
  sampleIndex: number,
  sampleInterval: number,
): UtilityDisplayPoint | null {
  const candidateIndices = [
    sampleIndex,
    sampleIndex + 1,
    sampleIndex - 1,
    sampleIndex + 2,
    sampleIndex - 2,
  ];

  for (const index of candidateIndices) {
    if (index < 0 || index >= utility.trajectory.x.length) {
      continue;
    }

    const nextIndex = Math.min(utility.trajectory.x.length - 1, index + 1);
    const mix = index === sampleIndex
      ? Math.max(0, Math.min(1, (currentTick - utility.trajectory.sampleOriginTick - sampleIndex * sampleInterval) / sampleInterval))
      : 0;
    const x = interpolateNullableNumber(utility.trajectory.x[index], utility.trajectory.x[nextIndex], mix);
    const y = interpolateNullableNumber(utility.trajectory.y[index], utility.trajectory.y[nextIndex], mix);
    if (x == null || y == null || !isWorldPointNearMap(replay, x, y)) {
      continue;
    }

    const point = worldToScreen(replay, radarViewport, x, y);
    if (!isScreenPointVisible(point, radarViewport)) {
      continue;
    }

    return {
      point,
      sampleIndex: index,
      source: "trajectory",
    };
  }

  return null;
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

function resolveSmokeDetonationTick(utility: UtilityEntity) {
  return utility.detonateTick ?? utility.phaseEvents.find((event) => event.type === "detonate")?.tick ?? null;
}

function resolveSmokeActivePoint(replay: Replay, utility: UtilityEntity, radarViewport: RadarViewport, detonateTick: number | null) {
  const detonateEvent = [...utility.phaseEvents]
    .filter((event) => event.type === "detonate" && event.x != null && event.y != null)
    .sort((left, right) => right.tick - left.tick)[0];

  if (detonateEvent?.x != null && detonateEvent?.y != null) {
    const phasePoint = worldToScreen(replay, radarViewport, detonateEvent.x, detonateEvent.y);
    if (isScreenPointVisible(phasePoint, radarViewport)) {
      return phasePoint;
    }
  }

  if (detonateTick != null) {
    const detonatePoint = utilityPointAtTick(replay, utility, detonateTick, radarViewport, false);
    if (detonatePoint) {
      return detonatePoint.point;
    }
  }

  return null;
}
