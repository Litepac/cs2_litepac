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
  const pulse = 0.992 + ((Math.sin(currentTick / 24) + 1) / 2) * 0.018;
  const ringColor = throwerSide === "CT" ? 0x3fa8ff : throwerSide === "T" ? 0xf3a448 : 0xe8edf2;
  const cloudShadow = new Graphics();
  const smokeMass = new Graphics();
  const smokeHighlights = new Graphics();
  const shadowPuffs = [
    { dx: -12, dy: 11, width: 15, height: 8, alpha: 0.11 },
    { dx: 0, dy: 12, width: 18, height: 9, alpha: 0.12 },
    { dx: 13, dy: 10, width: 15, height: 8, alpha: 0.11 },
  ];
  const puffs = [
    { dx: -14, dy: -12, radius: 6.6, alpha: 0.84, color: 0xe9eef2 },
    { dx: -4, dy: -14, radius: 7.2, alpha: 0.86, color: 0xf0f4f7 },
    { dx: 8, dy: -13, radius: 6.9, alpha: 0.86, color: 0xf0f4f7 },
    { dx: 17, dy: -7, radius: 6.2, alpha: 0.83, color: 0xe6ecef },
    { dx: -18, dy: -2, radius: 6.5, alpha: 0.83, color: 0xe5ebef },
    { dx: -9, dy: -1, radius: 7.4, alpha: 0.88, color: 0xf1f5f8 },
    { dx: 2, dy: 0, radius: 7.8, alpha: 0.9, color: 0xf6fafc },
    { dx: 13, dy: -1, radius: 7.2, alpha: 0.87, color: 0xecf1f4 },
    { dx: -16, dy: 10, radius: 6.2, alpha: 0.82, color: 0xe1e8ec },
    { dx: -5, dy: 10, radius: 7.1, alpha: 0.86, color: 0xecf1f4 },
    { dx: 7, dy: 10, radius: 7.1, alpha: 0.86, color: 0xecf1f4 },
    { dx: 17, dy: 9, radius: 6.1, alpha: 0.82, color: 0xe1e8ec },
    { dx: -2, dy: 19, radius: 5.9, alpha: 0.78, color: 0xdbe4ea },
  ];
  const highlights = [
    { dx: -5, dy: -7, radius: 3.8, alpha: 0.34, color: 0xffffff },
    { dx: 7, dy: -6, radius: 3.6, alpha: 0.32, color: 0xffffff },
    { dx: 1, dy: 6, radius: 4.1, alpha: 0.24, color: 0xf9fcff },
  ];
  for (const puff of shadowPuffs) {
    cloudShadow.ellipse(point.x + puff.dx, point.y + puff.dy, puff.width * pulse, puff.height * pulse);
    cloudShadow.fill({ color: 0x090d11, alpha: puff.alpha });
  }
  layer.addChild(cloudShadow);

  for (const puff of puffs) {
    smokeMass.circle(point.x + puff.dx, point.y + puff.dy, puff.radius * pulse);
    smokeMass.fill({ color: puff.color, alpha: puff.alpha });
  }
  layer.addChild(smokeMass);

  for (const puff of highlights) {
    smokeHighlights.circle(point.x + puff.dx, point.y + puff.dy, puff.radius * pulse);
    smokeHighlights.fill({ color: puff.color, alpha: puff.alpha });
  }
  layer.addChild(smokeHighlights);

  if (remainingSeconds != null) {
    const progress = Math.max(0, Math.min(1, remainingSeconds / 20));
    const ringCenter = { x: point.x + 1, y: point.y - 1 };
    drawProgressRing(layer, ringCenter, 17.5, progress, ringColor, {
      backdropAlpha: 0.11,
      backdropColor: 0xeff4f8,
      width: 3.3,
      alpha: 0.86,
    });
  }
}

function drawFireVisual(layer: Container, point: ScreenPoint, remainingSeconds: number | null) {
  const scorch = new Graphics();
  const fireMass = new Graphics();
  const hotCore = new Graphics();
  const flameTips = new Graphics();
  const embers = new Graphics();

  const scorchPatches = [
    { dx: -12, dy: 9, width: 13, height: 7, alpha: 0.16 },
    { dx: 1, dy: 10, width: 15, height: 8, alpha: 0.17 },
    { dx: 14, dy: 8, width: 12, height: 7, alpha: 0.15 },
    { dx: -2, dy: 2, width: 22, height: 10, alpha: 0.1 },
  ];
  for (const patch of scorchPatches) {
    scorch.ellipse(point.x + patch.dx, point.y + patch.dy, patch.width, patch.height);
    scorch.fill({ color: 0x150d08, alpha: patch.alpha });
  }
  layer.addChild(scorch);

  const flamePuffs = [
    { dx: -15, dy: 3, radius: 6.3, alpha: 0.72, color: 0xff8a37 },
    { dx: -7, dy: -3, radius: 6.8, alpha: 0.76, color: 0xffa03f },
    { dx: 2, dy: -5, radius: 7.3, alpha: 0.8, color: 0xffb34c },
    { dx: 12, dy: -2, radius: 6.5, alpha: 0.74, color: 0xff983b },
    { dx: 17, dy: 5, radius: 5.8, alpha: 0.68, color: 0xff7b31 },
    { dx: -11, dy: 10, radius: 6.1, alpha: 0.68, color: 0xff8f39 },
    { dx: 0, dy: 11, radius: 7.1, alpha: 0.74, color: 0xffa642 },
    { dx: 11, dy: 10, radius: 6.2, alpha: 0.69, color: 0xff8d38 },
    { dx: -1, dy: 2, radius: 8.3, alpha: 0.78, color: 0xffbf58 },
  ];
  for (const puff of flamePuffs) {
    fireMass.circle(point.x + puff.dx, point.y + puff.dy, puff.radius);
    fireMass.fill({ color: puff.color, alpha: puff.alpha });
  }
  layer.addChild(fireMass);

  const corePuffs = [
    { dx: -5, dy: 0, radius: 3.7, alpha: 0.52, color: 0xffe2a0 },
    { dx: 4, dy: -1, radius: 4.2, alpha: 0.56, color: 0xfff0c6 },
    { dx: 1, dy: 7, radius: 4.4, alpha: 0.46, color: 0xffd98c },
  ];
  for (const puff of corePuffs) {
    hotCore.circle(point.x + puff.dx, point.y + puff.dy, puff.radius);
    hotCore.fill({ color: puff.color, alpha: puff.alpha });
  }
  layer.addChild(hotCore);

  const tongues = [
    { dx: -9, dy: -10, width: 4.7, height: 8.6, color: 0xffc56a, alpha: 0.28 },
    { dx: 1, dy: -13, width: 5.4, height: 10.2, color: 0xffe0a8, alpha: 0.26 },
    { dx: 10, dy: -10, width: 4.5, height: 8.2, color: 0xffbf63, alpha: 0.24 },
  ];
  for (const tongue of tongues) {
    flameTips.ellipse(point.x + tongue.dx, point.y + tongue.dy, tongue.width, tongue.height);
    flameTips.fill({ color: tongue.color, alpha: tongue.alpha });
  }
  layer.addChild(flameTips);

  const emberDots = [
    { dx: -16, dy: -3, radius: 1, color: 0xffcd78, alpha: 0.28 },
    { dx: 15, dy: -1, radius: 0.95, color: 0xffc167, alpha: 0.25 },
    { dx: -4, dy: -11, radius: 0.95, color: 0xffe1af, alpha: 0.22 },
    { dx: 7, dy: -9, radius: 0.8, color: 0xffefcf, alpha: 0.18 },
  ];
  for (const ember of emberDots) {
    embers.circle(point.x + ember.dx, point.y + ember.dy, ember.radius);
    embers.fill({ color: ember.color, alpha: ember.alpha });
  }
  layer.addChild(embers);

  if (remainingSeconds != null) {
    const progress = Math.max(0, Math.min(1, remainingSeconds / 7));
    drawProgressRing(layer, { x: point.x + 1, y: point.y + 1 }, 18.5, progress, 0xffc467, {
      backdropAlpha: 0.08,
      backdropColor: 0xffefcf,
      width: 3,
      alpha: 0.84,
    });
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
  burst.circle(point.x, point.y, 18 + burstAgeTicks * 5.2);
  burst.fill({ color: 0xfffdf1, alpha: 0.1 * alpha });
  burst.circle(point.x, point.y, 34 + burstAgeTicks * 6.8);
  burst.fill({ color: 0xfffdf1, alpha: 0.06 * alpha });
  burst.circle(point.x, point.y, 56 + burstAgeTicks * 8.4);
  burst.fill({ color: 0xfffdf1, alpha: 0.025 * alpha });
  burst.circle(point.x, point.y, 10 + burstAgeTicks * 2.2);
  burst.fill({ color: 0xfff9da, alpha: 0.3 * alpha });
  burst.circle(point.x, point.y, 14 + burstAgeTicks * 3.1);
  burst.stroke({ color: 0xfff4a8, width: 2.2, alpha: 0.42 * alpha });
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
      marker.circle(point.x, point.y, 8.5);
      marker.fill({ color: 0xfff7b8, alpha: 0.12 });
      marker.circle(point.x, point.y, 5.4);
      marker.fill({ color: 0xfaf089, alpha: 0.95 });
      marker.moveTo(point.x - 7, point.y);
      marker.lineTo(point.x + 7, point.y);
      marker.moveTo(point.x, point.y - 7);
      marker.lineTo(point.x, point.y + 7);
      marker.stroke({ color: 0xfff9dc, width: 1.3, alpha: 0.82 });
      break;
    case "hegrenade":
      marker.circle(point.x, point.y, 7.8);
      marker.fill({ color: 0xff6b6b, alpha: 0.08 });
      marker.roundRect(point.x - 3.6, point.y - 5.2, 7.2, 10.4, 2.3);
      marker.fill({ color: 0x77838f, alpha: 0.96 });
      marker.rect(point.x - 1.7, point.y - 7.4, 3.4, 2.1);
      marker.fill({ color: 0xe5edf4, alpha: 0.9 });
      marker.moveTo(point.x + 1.8, point.y - 6.4);
      marker.lineTo(point.x + 4.6, point.y - 8.7);
      marker.stroke({ color: 0xe5edf4, width: 1.1, alpha: 0.88 });
      break;
    case "decoy":
      marker.roundRect(point.x - 5.5, point.y - 5.5, 11, 11, 3);
      marker.fill({ color: 0x9a6bff, alpha: 0.88 });
      marker.circle(point.x, point.y, 9);
      marker.stroke({ color: 0xcdb8ff, width: 1.2, alpha: 0.28 });
      break;
    case "smoke":
      marker.circle(point.x, point.y, 8.5);
      marker.fill({ color: 0xced8e1, alpha: 0.1 });
      marker.roundRect(point.x - 3.6, point.y - 5.2, 7.2, 10.2, 2.4);
      marker.fill({ color: 0xe4e8ed, alpha: 0.95 });
      marker.rect(point.x - 2.1, point.y - 7.7, 4.2, 2.6);
      marker.fill({ color: 0xaeb8c1, alpha: 0.95 });
      break;
    case "molotov":
    case "incendiary":
      marker.circle(point.x, point.y + 1, 9.5);
      marker.fill({ color: 0xff8f3f, alpha: 0.12 });
      marker.roundRect(point.x - 3.8, point.y - 6.5, 7.6, 13, 2.3);
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

function drawProgressRing(
  layer: Container,
  point: ScreenPoint,
  radius: number,
  progress: number,
  color: number,
  options: {
    alpha: number;
    backdropAlpha?: number;
    backdropColor?: number;
    width: number;
  },
) {
  const ring = new Graphics();
  if ((options.backdropAlpha ?? 0) > 0) {
    ring.circle(point.x, point.y, radius);
    ring.stroke({
      color: options.backdropColor ?? color,
      width: Math.max(1, options.width - 0.9),
      alpha: options.backdropAlpha,
    });
  }

  const startAngle = -Math.PI / 2;
  const endAngle = startAngle + Math.PI * 2 * progress;
  const startX = point.x + Math.cos(startAngle) * radius;
  const startY = point.y + Math.sin(startAngle) * radius;
  ring.moveTo(startX, startY);
  ring.arc(point.x, point.y, radius, startAngle, endAngle);
  ring.stroke({ color, width: options.width, alpha: options.alpha });
  layer.addChild(ring);
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
