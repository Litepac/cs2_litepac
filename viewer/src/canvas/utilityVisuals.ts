import { Container, Graphics, Text } from "pixi.js";

import type { RadarViewport } from "../maps/transform";
import { worldToScreen } from "../maps/transform";
import { normalizeUtilityVisualKind, utilityColorPixi } from "../replay/utilityPresentation";
import type { Replay, UtilityEntity } from "../replay/types";
import {
  utilityActivationTick,
  utilityLifecycleEndTick,
  utilityPresentationRemainingSeconds,
  utilitySceneStateAtTick,
  type UtilitySceneState,
} from "../replay/utility";

type ScreenPoint = {
  x: number;
  y: number;
};

type UtilityDisplayPoint = {
  point: ScreenPoint;
  sampleIndex: number | null;
  source: "phase" | "trajectory";
};

type SmokeDisplacementVisual = {
  ageRatio: number;
  center: ScreenPoint;
  radius: number;
};

type UtilityPhase = "projectile" | "active" | "burst";

export function drawUtilityVisual(
  trailLayer: Container,
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
      trailLayer,
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

  if (renderPhase === "projectile") {
    drawProjectileTrajectoryVisual(
      trailLayer,
      replay,
      utility,
      currentTick,
      radarViewport,
      throwerSide,
    );
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
      drawFireVisual(overlayLayer, point, state?.presentationRemainingSeconds ?? null);
      return;
    }

    if (utility.kind === "decoy") {
      drawDecoyVisual(overlayLayer, point, state?.remainingSeconds ?? null);
      return;
    }
  }

  drawProjectileVisual(overlayLayer, point, utility.kind, throwerSide);
}

export function drawUtilityAtlasVisual(
  trailLayer: Container,
  overlayLayer: Container,
  replay: Replay,
  utility: UtilityEntity,
  throwerSide: "T" | "CT" | null,
  radarViewport: RadarViewport,
  options?: {
    emphasize?: boolean;
    endpointAlpha?: number;
    trailAlpha?: number;
  },
  onSelect?: () => void,
) {
  const utilityKind = normalizeUtilityVisualKind(utility.kind) ?? "smoke";
  const trajectoryMode = resolveAtlasTrajectoryMode(utility.kind, options?.emphasize ?? false);
  const showTrajectory = trajectoryMode !== "none";
  const trajectoryPoints = showTrajectory
    ? trajectoryTrailPoints(
        replay,
        utility,
        utilityLifecycleEndTick(utility),
        radarViewport,
        trajectoryMode === "minimal" ? 2 : 1,
      )
    : [];
  if (trajectoryPoints.length >= 2) {
    const trail = new Graphics();
    trail.moveTo(trajectoryPoints[0].x, trajectoryPoints[0].y);
    for (let index = 1; index < trajectoryPoints.length; index += 1) {
      trail.lineTo(trajectoryPoints[index].x, trajectoryPoints[index].y);
    }
    trail.stroke({
      color: utilityColorPixi(utilityKind),
      width:
        options?.emphasize
          ? trajectoryMode === "primary"
            ? 2.45
            : 1.85
          : trajectoryMode === "primary"
            ? 1.7
            : 1.25,
      alpha: options?.trailAlpha ?? resolveAtlasTrailAlpha(utility.kind, options?.emphasize ?? false, trajectoryMode),
      cap: "round",
      join: "round",
    });
    trailLayer.addChild(trail);
  }

  const activePoint = resolveUtilityAtlasOutcomePoint(replay, utility, radarViewport);

  if (!activePoint) {
    return;
  }

  if (onSelect) {
    const hitTarget = new Graphics();
    hitTarget.circle(
      activePoint.x,
      activePoint.y,
      utility.kind === "smoke" || utility.kind === "molotov" || utility.kind === "incendiary" ? 18 : 14,
    );
    hitTarget.fill({ color: 0xffffff, alpha: 0.001 });
    hitTarget.eventMode = "static";
    hitTarget.cursor = "pointer";
    hitTarget.on("pointertap", (event) => {
      event.stopPropagation();
      onSelect();
    });
    overlayLayer.addChild(hitTarget);
  }

  if (utility.kind === "smoke") {
    const cloud = new Graphics();
    cloud.circle(activePoint.x, activePoint.y, options?.emphasize ? 11.5 : 9.2);
    cloud.fill({ color: 0xe9f0f5, alpha: options?.endpointAlpha ?? (options?.emphasize ? 0.4 : 0.22) });
    cloud.circle(activePoint.x, activePoint.y, options?.emphasize ? 15.8 : 13);
    cloud.stroke({
      color: throwerSide === "CT" ? 0x4faeff : throwerSide === "T" ? 0xf3a448 : 0xbac8d3,
      width: options?.emphasize ? 1.8 : 1.3,
      alpha: options?.emphasize ? 0.66 : 0.38,
    });
    overlayLayer.addChild(cloud);
    return;
  }

  if (utility.kind === "molotov" || utility.kind === "incendiary") {
    const fire = new Graphics();
    fire.circle(activePoint.x, activePoint.y, options?.emphasize ? 10 : 8.2);
    fire.fill({ color: 0xffb461, alpha: options?.endpointAlpha ?? (options?.emphasize ? 0.42 : 0.2) });
    fire.circle(activePoint.x, activePoint.y, options?.emphasize ? 13.2 : 11.2);
    fire.stroke({ color: 0xffd4a3, width: options?.emphasize ? 1.6 : 1.15, alpha: options?.emphasize ? 0.42 : 0.22 });
    overlayLayer.addChild(fire);
    return;
  }

  if (utility.kind === "flashbang") {
    const flash = new Graphics();
    flash.circle(activePoint.x, activePoint.y, options?.emphasize ? 12.6 : 10.4);
    flash.fill({ color: 0xfff6d6, alpha: options?.endpointAlpha ?? (options?.emphasize ? 0.24 : 0.14) });
    flash.circle(activePoint.x, activePoint.y, options?.emphasize ? 21.5 : 17.4);
    flash.stroke({ color: 0xfff8e7, width: options?.emphasize ? 2.35 : 1.75, alpha: options?.emphasize ? 0.62 : 0.36 });
    flash.circle(activePoint.x, activePoint.y, options?.emphasize ? 5.2 : 4.1);
    flash.fill({ color: 0xfffef8, alpha: options?.emphasize ? 0.74 : 0.46 });
    overlayLayer.addChild(flash);
    return;
  }

  if (utility.kind === "hegrenade") {
    const burst = new Graphics();
    burst.circle(activePoint.x, activePoint.y, options?.emphasize ? 7.8 : 6.3);
    burst.fill({ color: 0xff8c79, alpha: options?.endpointAlpha ?? (options?.emphasize ? 0.28 : 0.16) });
    burst.circle(activePoint.x, activePoint.y, options?.emphasize ? 16.4 : 13.2);
    burst.stroke({ color: 0xffb2a1, width: options?.emphasize ? 2.2 : 1.55, alpha: options?.emphasize ? 0.54 : 0.3 });
    burst.circle(activePoint.x, activePoint.y, options?.emphasize ? 3.9 : 3.1);
    burst.fill({ color: 0xffe1d7, alpha: options?.emphasize ? 0.64 : 0.36 });
    overlayLayer.addChild(burst);
    return;
  }

  drawProjectileVisual(overlayLayer, activePoint, utility.kind, throwerSide);
  const endpoint = overlayLayer.children[overlayLayer.children.length - 1] as Graphics | undefined;
  if (endpoint) {
    endpoint.alpha = options?.endpointAlpha ?? (options?.emphasize ? 0.88 : 0.48);
    endpoint.scale.set(options?.emphasize ? 1.08 : 0.9);
  }
}

function drawSmokeUtilityVisual(
  trailLayer: Container,
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
    presentationRemainingSeconds: projectile ? null : utilityPresentationRemainingSeconds(utility, currentTick, tickRate),
  };

  if (projectile) {
    drawProjectileTrajectoryVisual(
      trailLayer,
      replay,
      utility,
      currentTick,
      radarViewport,
      throwerSide,
    );
    const projectilePoint = utilityPointAtTick(replay, utility, currentTick, radarViewport, false);
    const point = projectilePoint?.point ?? null;
    if (!point) {
      return;
    }

    drawProjectileVisual(overlayLayer, point, utility.kind, throwerSide);
    return;
  }

  const activePoint = resolveSmokeActivePoint(replay, utility, radarViewport, detonateTick);
  if (!activePoint) {
    return;
  }

  drawSmokeVisual(
    overlayLayer,
    activePoint,
    state.remainingSeconds,
    currentTick,
    throwerSide,
    resolveSmokeDisplacementVisual(replay, utility, currentTick, radarViewport),
  );
}

function drawSmokeVisual(
  layer: Container,
  point: ScreenPoint,
  remainingSeconds: number | null,
  currentTick: number,
  throwerSide: "T" | "CT" | null,
  displacement: SmokeDisplacementVisual | null,
) {
  const pulse = 0.995 + ((Math.sin(currentTick / 28) + 1) / 2) * 0.014;
  const ringColor = throwerSide === "CT" ? 0x3fa8ff : throwerSide === "T" ? 0xf3a448 : 0xe8edf2;
  const smokeVeil = new Graphics();
  const cloudShadow = new Graphics();
  const smokeMass = new Graphics();
  const smokeCore = new Graphics();
  const smokeHighlights = new Graphics();
  const smokeDisplacementCutout = new Graphics();
  const smokeDisplacementRim = new Graphics();
  const shadowPuffs = [
    { dx: -15, dy: 12, width: 18, height: 9, alpha: 0.12 },
    { dx: -1, dy: 13, width: 22, height: 11, alpha: 0.13 },
    { dx: 16, dy: 11, width: 18, height: 9, alpha: 0.12 },
    { dx: -3, dy: 4, width: 29, height: 14, alpha: 0.08 },
  ];
  const veilPuffs = [
    { dx: -9, dy: -6, width: 22, height: 17, alpha: 0.11, color: 0xf3f7fa },
    { dx: 9, dy: -5, width: 21, height: 16, alpha: 0.11, color: 0xf3f7fa },
    { dx: 0, dy: 8, width: 28, height: 19, alpha: 0.12, color: 0xe7edf2 },
    { dx: -18, dy: 2, width: 15, height: 12, alpha: 0.09, color: 0xe9eef2 },
    { dx: 18, dy: 1, width: 15, height: 12, alpha: 0.09, color: 0xe9eef2 },
  ];
  const puffs = [
    { dx: -15, dy: -11, radius: 7.6, alpha: 0.8, color: 0xe5ebef },
    { dx: -5, dy: -14, radius: 8.4, alpha: 0.84, color: 0xf0f4f7 },
    { dx: 8, dy: -13, radius: 8.2, alpha: 0.84, color: 0xf1f5f8 },
    { dx: 19, dy: -7, radius: 7.2, alpha: 0.76, color: 0xe5ebef },
    { dx: -21, dy: -1, radius: 7.2, alpha: 0.74, color: 0xdde5ea },
    { dx: -11, dy: 0, radius: 8.7, alpha: 0.84, color: 0xebf0f4 },
    { dx: 1, dy: 0, radius: 9.5, alpha: 0.9, color: 0xf6fafc },
    { dx: 13, dy: -1, radius: 8.8, alpha: 0.84, color: 0xecf2f6 },
    { dx: -17, dy: 11, radius: 6.8, alpha: 0.72, color: 0xdce5eb },
    { dx: -6, dy: 11, radius: 8.2, alpha: 0.8, color: 0xeaf0f4 },
    { dx: 8, dy: 11, radius: 8.2, alpha: 0.8, color: 0xeaf0f4 },
    { dx: 18, dy: 10, radius: 6.9, alpha: 0.72, color: 0xdce5eb },
    { dx: -2, dy: 20, radius: 6.7, alpha: 0.68, color: 0xd8e2e9 },
  ];
  const corePuffs = [
    { dx: -6, dy: -5, radius: 4.8, alpha: 0.26, color: 0xffffff },
    { dx: 5, dy: -4, radius: 5.1, alpha: 0.28, color: 0xffffff },
    { dx: 0, dy: 5, radius: 5.8, alpha: 0.24, color: 0xfbfeff },
  ];
  const highlights = [
    { dx: -7, dy: -8, radius: 4.2, alpha: 0.18, color: 0xffffff },
    { dx: 8, dy: -7, radius: 4.1, alpha: 0.16, color: 0xffffff },
    { dx: 2, dy: 7, radius: 4.5, alpha: 0.14, color: 0xf8fbfe },
  ];
  for (const puff of shadowPuffs) {
    const x = point.x + puff.dx;
    const y = point.y + puff.dy;
    const alpha = displacedSmokeAlpha(x, y, puff.alpha, displacement, 1.1);
    if (alpha <= 0.01) {
      continue;
    }
    cloudShadow.ellipse(x, y, puff.width * pulse, puff.height * pulse);
    cloudShadow.fill({ color: 0x090d11, alpha });
  }
  layer.addChild(cloudShadow);

  for (const puff of veilPuffs) {
    const x = point.x + puff.dx;
    const y = point.y + puff.dy;
    const alpha = displacedSmokeAlpha(x, y, puff.alpha, displacement, 1.05);
    if (alpha <= 0.01) {
      continue;
    }
    smokeVeil.ellipse(x, y, puff.width * pulse, puff.height * pulse);
    smokeVeil.fill({ color: puff.color, alpha });
  }
  layer.addChild(smokeVeil);

  for (const puff of puffs) {
    const x = point.x + puff.dx;
    const y = point.y + puff.dy;
    const alpha = displacedSmokeAlpha(x, y, puff.alpha, displacement, 1);
    if (alpha <= 0.01) {
      continue;
    }
    smokeMass.circle(x, y, puff.radius * pulse);
    smokeMass.fill({ color: puff.color, alpha });
  }
  layer.addChild(smokeMass);

  for (const puff of corePuffs) {
    const x = point.x + puff.dx;
    const y = point.y + puff.dy;
    const alpha = displacedSmokeAlpha(x, y, puff.alpha, displacement, 0.95);
    if (alpha <= 0.01) {
      continue;
    }
    smokeCore.circle(x, y, puff.radius * pulse);
    smokeCore.fill({ color: puff.color, alpha });
  }
  layer.addChild(smokeCore);

  for (const puff of highlights) {
    const x = point.x + puff.dx;
    const y = point.y + puff.dy;
    const alpha = displacedSmokeAlpha(x, y, puff.alpha, displacement, 0.88);
    if (alpha <= 0.01) {
      continue;
    }
    smokeHighlights.circle(x, y, puff.radius * pulse);
    smokeHighlights.fill({ color: puff.color, alpha });
  }
  layer.addChild(smokeHighlights);

  if (displacement) {
    smokeDisplacementCutout.circle(displacement.center.x, displacement.center.y, displacement.radius * 0.9);
    smokeDisplacementCutout.fill({
      color: 0x131b22,
      alpha: 0.012 + displacement.ageRatio * 0.028,
    });
    smokeDisplacementCutout.circle(displacement.center.x, displacement.center.y, displacement.radius * 0.5);
    smokeDisplacementCutout.fill({
      color: 0x0d141a,
      alpha: 0.02 + displacement.ageRatio * 0.038,
    });
    layer.addChild(smokeDisplacementCutout);

    smokeDisplacementRim.circle(displacement.center.x, displacement.center.y, displacement.radius * 0.84);
    smokeDisplacementRim.stroke({
      color: 0xf6fbff,
      width: 1,
      alpha: 0.016 + displacement.ageRatio * 0.03,
    });
    layer.addChild(smokeDisplacementRim);
  }

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
  const ageRatio = Math.max(0, 1 - burstAgeTicks / 14);
  const burst = new Graphics();
  burst.circle(point.x, point.y, 16 + burstAgeTicks * 3.1);
  burst.fill({ color: 0xfffffd, alpha: 0.68 * ageRatio });
  burst.circle(point.x, point.y, 26 + burstAgeTicks * 5.2);
  burst.fill({ color: 0xfffae5, alpha: 0.28 * ageRatio });
  burst.circle(point.x, point.y, 44 + burstAgeTicks * 6.9);
  burst.fill({ color: 0xfff5cf, alpha: 0.14 * ageRatio });
  burst.circle(point.x, point.y, 68 + burstAgeTicks * 8.3);
  burst.fill({ color: 0xfff8e7, alpha: 0.072 * ageRatio });
  burst.circle(point.x, point.y, 20 + burstAgeTicks * 4.1);
  burst.stroke({ color: 0xffe89b, width: 3.4, alpha: 0.56 * ageRatio });
  burst.circle(point.x, point.y, 11 + burstAgeTicks * 1.5);
  burst.stroke({ color: 0xffffff, width: 1.9, alpha: 0.62 * ageRatio });
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

function drawProjectileVisual(
  layer: Container,
  point: ScreenPoint,
  kind: UtilityEntity["kind"],
  throwerSide: "T" | "CT" | null,
) {
  const marker = new Graphics();
  const sideFillColor = throwerSide === "CT" ? 0x4faeff : throwerSide === "T" ? 0xf3a448 : 0xd8e1e8;
  const darkStroke = 0x081116;
  const detailColor = 0x081116;

  switch (kind) {
    case "flashbang":
      drawFlashbangProjectileIcon(marker, point, sideFillColor, darkStroke, detailColor);
      break;
    case "hegrenade":
      drawHEProjectileIcon(marker, point, sideFillColor, darkStroke, detailColor);
      break;
    case "decoy":
      drawDecoyProjectileIcon(marker, point, sideFillColor, darkStroke, detailColor);
      break;
    case "smoke":
      drawSmokeProjectileIcon(marker, point, sideFillColor, darkStroke, detailColor);
      break;
    case "molotov":
    case "incendiary":
      drawMolotovProjectileIcon(marker, point, sideFillColor, darkStroke, detailColor);
      break;
    default:
      marker.rect(point.x - 5, point.y - 5, 10, 10);
      marker.fill({ color: 0xffffff, alpha: 0.9 });
      break;
  }

  layer.addChild(marker);
}

function drawProjectileTrajectoryVisual(
  layer: Container,
  replay: Replay,
  utility: UtilityEntity,
  currentTick: number,
  radarViewport: RadarViewport,
  throwerSide: "T" | "CT" | null,
) {
  const points = trajectoryTrailPoints(replay, utility, currentTick, radarViewport);
  if (points.length >= 2) {
    const trail = new Graphics();
    const trailColor = throwerSide === "CT" ? 0x4faeff : throwerSide === "T" ? 0xf3a448 : 0xd8e1e8;
    trail.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index += 1) {
      trail.lineTo(points[index].x, points[index].y);
    }
    trail.stroke({
      color: trailColor,
      width: 2.4,
      alpha: 0.96,
      cap: "round",
      join: "round",
    });
    layer.addChild(trail);
  }

  const bouncePoints = utility.phaseEvents
    .filter((event) => event.type === "bounce" && event.tick <= currentTick && event.x != null && event.y != null)
    .map((event) => worldToScreen(replay, radarViewport, event.x!, event.y!))
    .filter((point) => isScreenPointVisible(point, radarViewport));
  if (bouncePoints.length === 0) {
    return;
  }

  const trailColor = throwerSide === "CT" ? 0x4faeff : throwerSide === "T" ? 0xf3a448 : 0xd8e1e8;
  const bounceMarkers = new Graphics();
  for (const point of bouncePoints) {
    bounceMarkers.circle(point.x, point.y, 6.2);
    bounceMarkers.stroke({ color: trailColor, width: 1.9, alpha: 0.94 });
    bounceMarkers.circle(point.x, point.y, 1.6);
    bounceMarkers.fill({ color: trailColor, alpha: 0.94 });
  }
  layer.addChild(bounceMarkers);
}

function fillAndStrokeShape(
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

function drawFlashbangProjectileIcon(
  marker: Graphics,
  point: ScreenPoint,
  fillColor: number,
  strokeColor: number,
  detailColor: number,
) {
  fillAndStrokeShape(
    marker,
    () => marker.roundRect(point.x - 3.95, point.y - 8.35, 7.9, 15.9, 1.72),
    fillColor,
    strokeColor,
    1.58,
  );
  fillAndStrokeShape(
    marker,
    () => marker.rect(point.x - 1.95, point.y - 10.95, 3.9, 2.05),
    fillColor,
    strokeColor,
    1.1,
  );
  marker.moveTo(point.x + 1.65, point.y - 10.05);
  marker.lineTo(point.x + 3.05, point.y - 10.05);
  marker.lineTo(point.x + 3.05, point.y - 8.0);
  marker.stroke({ color: strokeColor, width: 1.08, alpha: 0.96, cap: "round", join: "round" });
  marker.circle(point.x + 5.6, point.y - 9.4, 1.9);
  marker.stroke({ color: strokeColor, width: 1.14, alpha: 0.96 });
  marker.moveTo(point.x, point.y - 4.85);
  marker.lineTo(point.x, point.y + 3.55);
  marker.stroke({ color: detailColor, width: 1.1, alpha: 0.7, cap: "round" });
}

function drawHEProjectileIcon(
  marker: Graphics,
  point: ScreenPoint,
  fillColor: number,
  strokeColor: number,
  detailColor: number,
) {
  fillAndStrokeShape(
    marker,
    () => marker.circle(point.x - 0.25, point.y + 0.6, 5.15),
    fillColor,
    strokeColor,
    1.44,
  );
  fillAndStrokeShape(
    marker,
    () => marker.rect(point.x - 0.95, point.y - 6.45, 1.9, 1.8),
    fillColor,
    strokeColor,
    1.06,
  );
  marker.moveTo(point.x + 1.55, point.y - 4.15);
  marker.lineTo(point.x + 4.45, point.y - 6.8);
  marker.stroke({ color: detailColor, width: 1.02, alpha: 0.9, cap: "round" });
  marker.circle(point.x + 5.35, point.y - 7.15, 1.02);
  marker.stroke({ color: detailColor, width: 0.86, alpha: 0.88 });
  marker.moveTo(point.x - 1.7, point.y + 0.55);
  marker.lineTo(point.x + 1.35, point.y + 0.55);
  marker.moveTo(point.x - 0.18, point.y - 0.95);
  marker.lineTo(point.x - 0.18, point.y + 2.05);
  marker.stroke({ color: detailColor, width: 0.94, alpha: 0.72, cap: "round" });
}

function drawDecoyProjectileIcon(
  marker: Graphics,
  point: ScreenPoint,
  fillColor: number,
  strokeColor: number,
  detailColor: number,
) {
  fillAndStrokeShape(
    marker,
    () => marker.roundRect(point.x - 2.45, point.y - 2.45, 4.9, 4.9, 1.08),
    fillColor,
    strokeColor,
    1.14,
  );
  marker.moveTo(point.x - 1.6, point.y);
  marker.lineTo(point.x + 1.6, point.y);
  marker.stroke({ color: detailColor, width: 0.88, alpha: 0.84, cap: "round" });
  marker.moveTo(point.x, point.y - 1.55);
  marker.lineTo(point.x, point.y + 1.55);
  marker.stroke({ color: detailColor, width: 0.74, alpha: 0.72, cap: "round" });
}

function drawSmokeProjectileIcon(
  marker: Graphics,
  point: ScreenPoint,
  fillColor: number,
  strokeColor: number,
  detailColor: number,
) {
  fillAndStrokeShape(
    marker,
    () => marker.roundRect(point.x - 3.55, point.y - 8.95, 7.1, 17.9, 1.58),
    fillColor,
    strokeColor,
    1.58,
  );
  fillAndStrokeShape(
    marker,
    () => marker.rect(point.x - 2.15, point.y - 10.9, 4.3, 1.65),
    fillColor,
    strokeColor,
    1.08,
  );
  fillAndStrokeShape(
    marker,
    () => marker.roundRect(point.x + 3.25, point.y - 5.2, 2.5, 8.85, 0.48),
    fillColor,
    strokeColor,
    1.12,
  );
  marker.moveTo(point.x - 1.95, point.y - 5.6);
  marker.lineTo(point.x + 1.95, point.y - 5.6);
  marker.moveTo(point.x - 1.95, point.y - 2.3);
  marker.lineTo(point.x + 1.95, point.y - 2.3);
  marker.moveTo(point.x - 1.95, point.y + 1);
  marker.lineTo(point.x + 1.95, point.y + 1);
  marker.moveTo(point.x - 1.95, point.y + 4.3);
  marker.lineTo(point.x + 1.95, point.y + 4.3);
  marker.stroke({ color: detailColor, width: 1.12, alpha: 0.76, cap: "round" });
}

function drawMolotovProjectileIcon(
  marker: Graphics,
  point: ScreenPoint,
  fillColor: number,
  strokeColor: number,
  detailColor: number,
) {
  fillAndStrokeShape(
    marker,
    () => marker.roundRect(point.x - 3.15, point.y - 4.55, 6.3, 10.2, 1.34),
    fillColor,
    strokeColor,
    1.38,
  );
  fillAndStrokeShape(
    marker,
    () => marker.rect(point.x - 0.95, point.y - 7.45, 1.9, 3.15),
    fillColor,
    strokeColor,
    1.02,
  );
  fillAndStrokeShape(
    marker,
    () => {
      marker.moveTo(point.x - 2.15, point.y - 4.45);
      marker.lineTo(point.x - 0.95, point.y - 6.15);
      marker.lineTo(point.x + 0.95, point.y - 6.15);
      marker.lineTo(point.x + 2.15, point.y - 4.45);
      marker.closePath();
    },
    fillColor,
    strokeColor,
    1,
  );
  marker.moveTo(point.x + 0.45, point.y - 7.6);
  marker.lineTo(point.x + 2.15, point.y - 9.45);
  marker.stroke({ color: detailColor, width: 1.12, alpha: 0.9, cap: "round" });
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

function displacedSmokeAlpha(
  x: number,
  y: number,
  baseAlpha: number,
  displacement: SmokeDisplacementVisual | null,
  falloffScale: number,
) {
  if (!displacement) {
    return baseAlpha;
  }

  const dx = x - displacement.center.x;
  const dy = y - displacement.center.y;
  const distance = Math.hypot(dx, dy);
  const falloffRadius = displacement.radius * falloffScale;
  if (distance >= falloffRadius) {
    return baseAlpha;
  }

  if (distance <= displacement.radius * 0.62) {
    return 0;
  }

  const openness = 1 - distance / Math.max(1, falloffRadius);
  const reduction = Math.min(1, 1.42 * displacement.ageRatio * Math.pow(openness, 0.96));
  return Math.max(0, baseAlpha * (1 - reduction));
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

function trajectoryTrailPoints(
  replay: Replay,
  utility: UtilityEntity,
  currentTick: number,
  radarViewport: RadarViewport,
  sampleStride = 1,
) {
  const endTick = Math.min(currentTick, utilityActivationTick(utility) ?? utilityLifecycleEndTick(utility));
  const points: ScreenPoint[] = [];
  const sampleInterval = Math.max(1, utility.trajectory.sampleIntervalTicks || 1);
  const sampleCount = utility.trajectory.x.length;

  for (let index = 0; index < sampleCount; index += Math.max(1, sampleStride)) {
    const sampleTick = utility.trajectory.sampleOriginTick + index * sampleInterval;
    if (sampleTick > endTick) {
      break;
    }

    const x = utility.trajectory.x[index];
    const y = utility.trajectory.y[index];
    if (x == null || y == null || !isWorldPointNearMap(replay, x, y)) {
      continue;
    }

    const point = worldToScreen(replay, radarViewport, x, y);
    if (!isScreenPointVisible(point, radarViewport)) {
      continue;
    }

    pushDistinctPoint(points, point);
  }

  const livePoint = utilityPointAtTick(replay, utility, endTick, radarViewport, false)?.point ?? null;
  if (livePoint) {
    pushDistinctPoint(points, livePoint);
  }

  return points;
}

function resolveAtlasTrajectoryMode(
  utilityKind: UtilityEntity["kind"],
  emphasize: boolean,
): "none" | "minimal" | "primary" {
  if (utilityKind === "smoke" || utilityKind === "molotov" || utilityKind === "incendiary") {
    return "primary";
  }

  if (utilityKind === "flashbang" || utilityKind === "hegrenade") {
    return "minimal";
  }

  if (utilityKind === "decoy") {
    return emphasize ? "minimal" : "none";
  }

  return "minimal";
}

function resolveAtlasTrailAlpha(
  utilityKind: UtilityEntity["kind"],
  emphasize: boolean,
  mode: "none" | "minimal" | "primary",
) {
  if (mode === "none") {
    return 0;
  }

  if (mode === "minimal") {
    if (utilityKind === "flashbang" || utilityKind === "hegrenade") {
      return emphasize ? 0.4 : 0.24;
    }

    return emphasize ? 0.32 : 0.18;
  }

  return emphasize ? 0.64 : 0.28;
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

function pushDistinctPoint(points: ScreenPoint[], point: ScreenPoint) {
  const last = points[points.length - 1];
  if (last && Math.abs(last.x - point.x) < 0.2 && Math.abs(last.y - point.y) < 0.2) {
    return;
  }

  points.push(point);
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

function resolveUtilityAtlasOutcomePoint(
  replay: Replay,
  utility: UtilityEntity,
  radarViewport: RadarViewport,
) {
  if (utility.kind === "smoke") {
    return resolveSmokeActivePoint(replay, utility, radarViewport, resolveSmokeDetonationTick(utility));
  }

  const outcomePhase =
    [...utility.phaseEvents]
      .filter((event) => event.x != null && event.y != null)
      .filter((event) =>
        utility.kind === "flashbang" || utility.kind === "hegrenade"
          ? event.type === "detonate"
          : event.type === "detonate" || event.type === "expire" || event.type === "land",
      )
      .sort((left, right) => right.tick - left.tick)[0] ?? null;

  if (outcomePhase?.x != null && outcomePhase?.y != null) {
    const phasePoint = worldToScreen(replay, radarViewport, outcomePhase.x, outcomePhase.y);
    if (isScreenPointVisible(phasePoint, radarViewport)) {
      return phasePoint;
    }
  }

  const phaseKind =
    utility.kind === "flashbang" || utility.kind === "hegrenade"
      ? "burst"
      : utility.kind === "molotov" || utility.kind === "incendiary"
        ? "active"
        : "projectile";

  return utilityDisplayPoint(replay, utility, utilityLifecycleEndTick(utility), radarViewport, phaseKind)?.point ?? null;
}

function resolveSmokeDisplacementVisual(
  replay: Replay,
  utility: UtilityEntity,
  currentTick: number,
  radarViewport: RadarViewport,
) {
  const activeDisplacement = [...utility.phaseEvents]
    .filter(
      (event) =>
        event.type === "displaced" &&
        event.x != null &&
        event.y != null &&
        (event.durationTicks ?? 0) > 0 &&
        event.tick <= currentTick &&
        event.tick + (event.durationTicks ?? 0) > currentTick,
    )
    .sort((left, right) => right.tick - left.tick)[0];

  if (!activeDisplacement || activeDisplacement.x == null || activeDisplacement.y == null || !activeDisplacement.durationTicks) {
    return null;
  }

  const center = worldToScreen(replay, radarViewport, activeDisplacement.x, activeDisplacement.y);
  const remainingTicks = activeDisplacement.tick + activeDisplacement.durationTicks - currentTick;
  const rawAgeRatio = Math.max(0, Math.min(1, remainingTicks / Math.max(1, activeDisplacement.durationTicks)));
  const elapsedRatio = 1 - rawAgeRatio;
  let ageRatio = 1;
  if (elapsedRatio > 0.55) {
    const refillRatio = Math.min(1, (elapsedRatio - 0.55) / 0.45);
    ageRatio = Math.pow(1 - refillRatio, 1.8);
  }

  return {
    ageRatio,
    center,
    radius: 12 + ageRatio * 10,
  };
}
