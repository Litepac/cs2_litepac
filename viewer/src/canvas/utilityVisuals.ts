import { Circle, Container, Graphics, Text } from "pixi.js";

import type { RadarViewport } from "../mapGeometry/transform";
import { worldToScreen } from "../mapGeometry/transform";
import { normalizeUtilityVisualKind } from "../replay/utilityPresentation";
import type { Replay, UtilityEntity } from "../replay/types";
import decoyIconSvg from "../icons/cs2-equipment/panorama/images/icons/equipment/decoy.svg?raw";
import flashbangIconSvg from "../icons/cs2-equipment/panorama/images/icons/equipment/flashbang.svg?raw";
import hegrenadeIconSvg from "../icons/cs2-equipment/panorama/images/icons/equipment/hegrenade.svg?raw";
import molotovIconSvg from "../icons/cs2-equipment/panorama/images/icons/equipment/molotov.svg?raw";
import smokegrenadeIconSvg from "../icons/cs2-equipment/panorama/images/icons/equipment/smokegrenade.svg?raw";
import {
  utilityActivationTick,
  utilityLifecycleEndTick,
  utilityPresentationRemainingSeconds,
  utilitySceneStateAtTick,
  type UtilitySceneState,
} from "../replay/utility";
import { createEquipmentIconGraphic, type EquipmentSvgIcon } from "./equipmentIconGraphics";
import { attachReplayHitTarget } from "./replayStage/hitTargets";
import { getSmokeFootprint } from "./smokeFootprint";

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

type FireFootprintVisual = {
  firstSampleTick: number;
  points: ScreenPoint[];
  sampleTick: number;
};

type UtilityPhase = "projectile" | "active" | "burst";

type UtilityOverlayStyle = {
  coreColor: number;
  endpointColor: number;
  ringColor: number;
  trailColor: number;
};

function utilityOverlayStyle(kind: UtilityEntity["kind"]): UtilityOverlayStyle {
  switch (kind) {
    case "smoke":
      return { coreColor: 0xf5f8fa, endpointColor: 0xdce6ee, ringColor: 0xb8c4cb, trailColor: 0xb9c6ce };
    case "flashbang":
      return { coreColor: 0xffffff, endpointColor: 0xfff2b8, ringColor: 0xfff8e7, trailColor: 0xffdf7a };
    case "hegrenade":
      return { coreColor: 0xffe2da, endpointColor: 0xff7669, ringColor: 0xffaa9f, trailColor: 0xff7669 };
    case "molotov":
    case "incendiary":
      return { coreColor: 0xfff0bf, endpointColor: 0xffa84e, ringColor: 0xffcf86, trailColor: 0xffa84e };
    case "decoy":
      return { coreColor: 0xf0e8ff, endpointColor: 0xcdb8ff, ringColor: 0xe0d2ff, trailColor: 0xcdb8ff };
    default:
      return { coreColor: 0xffffff, endpointColor: 0xd8e1e8, ringColor: 0xf0f5f9, trailColor: 0xd8e1e8 };
  }
}

function utilityTeamAccentColor(side: "T" | "CT" | null) {
  if (side === "CT") {
    return 0x4faeff;
  }

  if (side === "T") {
    return 0xf3a448;
  }

  return 0xb7c2ca;
}

function utilityTeamPlateFill(side: "T" | "CT" | null) {
  if (side === "CT") {
    return 0x071a27;
  }

  if (side === "T") {
    return 0x241606;
  }

  return 0x0d1114;
}

function utilitySvgIcon(kind: UtilityEntity["kind"]): EquipmentSvgIcon {
  switch (kind) {
    case "flashbang":
      return { svg: flashbangIconSvg, width: 30, height: 32 };
    case "hegrenade":
      return { svg: hegrenadeIconSvg, width: 25, height: 33 };
    case "smoke":
      return { svg: smokegrenadeIconSvg, width: 15, height: 32 };
    case "molotov":
    case "incendiary":
      return { svg: molotovIconSvg, width: 22, height: 32 };
    case "decoy":
      return { svg: decoyIconSvg, width: 30, height: 32 };
    default:
      return { svg: smokegrenadeIconSvg, width: 15, height: 32 };
  }
}

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
  mapClipMask: Container | null = null,
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
      mapClipMask,
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
      drawFireVisual(
        overlayLayer,
        point,
        state?.remainingSeconds ?? null,
        throwerSide,
        resolveFireFootprintVisual(replay, utility, currentTick, radarViewport),
        currentTick,
      );
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
  const teamAccent = utilityTeamAccentColor(throwerSide);
  const trajectoryMode = resolveAtlasTrajectoryMode(utility.kind, options?.emphasize ?? false);
  const showTrajectory = trajectoryMode !== "none";
  const trajectoryPoints = showTrajectory
    ? trajectoryTrailPoints(
        replay,
        utility,
        utilityLifecycleEndTick(utility),
        radarViewport,
        trajectoryMode === "minimal" ? (options?.emphasize ? 2 : 4) : 1,
        { clampToActivation: false },
      )
    : [];
  if (trajectoryPoints.length >= 2) {
    drawAtlasTrajectoryTrail(
      trailLayer,
      trajectoryPoints,
      teamAccent,
      utility.kind,
      trajectoryMode,
      options?.emphasize ?? false,
      options?.trailAlpha,
    );
  }

  const activePoint = resolveUtilityAtlasOutcomePoint(replay, utility, radarViewport);

  if (!activePoint) {
    return;
  }

  if (utilityKind) {
    drawAtlasEndpointVisual(overlayLayer, activePoint, utility.kind, throwerSide, options?.emphasize ?? false, options?.endpointAlpha);
    drawAtlasEndpointHitTarget(overlayLayer, activePoint, utility.kind, onSelect);
    return;
  }

  drawProjectileVisual(overlayLayer, activePoint, utility.kind, throwerSide);
  const endpoint = overlayLayer.children[overlayLayer.children.length - 1] as Graphics | undefined;
  if (endpoint) {
    endpoint.alpha = options?.endpointAlpha ?? (options?.emphasize ? 0.88 : 0.48);
    endpoint.scale.set(options?.emphasize ? 1.08 : 0.9);
  }
  drawAtlasEndpointHitTarget(overlayLayer, activePoint, utility.kind, onSelect);
}

function drawAtlasEndpointVisual(
  layer: Container,
  point: ScreenPoint,
  kind: UtilityEntity["kind"],
  throwerSide: "T" | "CT" | null,
  emphasize: boolean,
  endpointAlpha: number | undefined,
) {
  const style = utilityOverlayStyle(kind);
  const teamAccent = utilityTeamAccentColor(throwerSide);
  const plateFill = utilityTeamPlateFill(throwerSide);
  const endpoint = new Graphics();
  const plateSize = emphasize ? 25 : 21;
  const half = plateSize / 2;

  endpoint.roundRect(point.x - half, point.y - half, plateSize, plateSize, 3.4);
  endpoint.fill({ color: plateFill, alpha: emphasize ? 0.74 : 0.56 });
  endpoint.roundRect(point.x - half, point.y - half, plateSize, plateSize, 3.4);
  endpoint.stroke({
    color: teamAccent,
    width: emphasize ? 2.4 : 1.85,
    alpha: emphasize ? 0.92 : 0.72,
  });

  if (emphasize) {
    endpoint.roundRect(point.x - half - 2, point.y - half - 2, plateSize + 4, plateSize + 4, 4.6);
    endpoint.stroke({ color: style.coreColor, width: 1.05, alpha: 0.24 });
  }

  layer.addChild(endpoint);
  drawUtilityAtlasIcon(layer, point, kind, style, emphasize, endpointAlpha);
}

function drawUtilityAtlasIcon(
  layer: Container,
  point: ScreenPoint,
  kind: UtilityEntity["kind"],
  style: UtilityOverlayStyle,
  emphasize: boolean,
  endpointAlpha: number | undefined,
) {
  const iconDefinition = utilitySvgIcon(kind);
  const maxWidth = emphasize ? 15.8 : 13.4;
  const maxHeight = emphasize ? 16.8 : 14.2;
  const iconScale = Math.min(maxWidth / iconDefinition.width, maxHeight / iconDefinition.height);
  const icon = createEquipmentIconGraphic(
    iconDefinition,
    point.x,
    point.y,
    iconScale,
    style.endpointColor,
    endpointAlpha ?? (emphasize ? 0.98 : 0.9),
  );

  layer.addChild(icon);
}

function drawAtlasEndpointHitTarget(
  layer: Container,
  point: ScreenPoint,
  kind: UtilityEntity["kind"],
  onSelect: (() => void) | undefined,
) {
  if (!onSelect) {
    return;
  }

  const hitTarget = new Graphics();
  attachReplayHitTarget(hitTarget, {
    activateOn: "pointerdown",
    hitArea: new Circle(
      point.x,
      point.y,
      kind === "smoke" || kind === "molotov" || kind === "incendiary" ? 22 : 19,
    ),
    onActivate: onSelect,
  });
  layer.addChild(hitTarget);
}

function drawAtlasTrajectoryTrail(
  layer: Container,
  points: ScreenPoint[],
  teamAccent: number,
  utilityKind: UtilityEntity["kind"],
  mode: "none" | "minimal" | "primary",
  emphasize: boolean,
  trailAlpha: number | undefined,
) {
  const visiblePoints = mode === "primary" ? points : [points[0], points[points.length - 1]];
  const baseAlpha = trailAlpha ?? resolveAtlasTrailAlpha(utilityKind, emphasize, mode);
  const shadow = new Graphics();
  drawScreenPolyline(shadow, visiblePoints);
  shadow.stroke({
    color: 0x020405,
    width: emphasize ? 4.2 : 2.35,
    alpha: emphasize ? Math.min(0.36, baseAlpha + 0.1) : Math.min(0.25, baseAlpha + 0.07),
    cap: "round",
    join: "round",
  });
  layer.addChild(shadow);

  const trail = new Graphics();
  drawScreenPolyline(trail, visiblePoints);
  trail.stroke({
    color: teamAccent,
    width:
      emphasize
        ? mode === "primary"
          ? 2.15
          : 1.75
        : mode === "primary"
          ? 1.65
          : 1.15,
    alpha: baseAlpha,
    cap: "round",
    join: "round",
  });
  layer.addChild(trail);

  if (!emphasize) {
    return;
  }

  const origin = points[0];
  const originMarker = new Graphics();
  originMarker.circle(origin.x, origin.y, emphasize ? 3.9 : 3.1);
  originMarker.fill({ color: 0x050708, alpha: 0.72 });
  originMarker.circle(origin.x, origin.y, emphasize ? 4.8 : 3.8);
  originMarker.stroke({ color: teamAccent, width: emphasize ? 1.35 : 1.05, alpha: Math.min(0.78, baseAlpha + 0.34) });
  layer.addChild(originMarker);
}

function drawScreenPolyline(graphics: Graphics, points: ScreenPoint[]) {
  graphics.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    graphics.lineTo(points[index].x, points[index].y);
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
  mapClipMask: Container | null,
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
    utility.utilityId,
    state.remainingSeconds,
    currentTick,
    throwerSide,
    detonateTick == null ? null : Math.max(0, (currentTick - detonateTick) / Math.max(1, tickRate)),
    detonateTick == null ? null : Math.max(0.1, (endTick - detonateTick) / Math.max(1, tickRate)),
    resolveSmokeDisplacementVisual(replay, utility, currentTick, radarViewport),
    mapClipMask,
  );
}

function drawSmokeVisual(
  layer: Container,
  point: ScreenPoint,
  utilityId: string,
  remainingSeconds: number | null,
  currentTick: number,
  throwerSide: "T" | "CT" | null,
  activeAgeSeconds: number | null,
  _activeDurationSeconds: number | null,
  displacement: SmokeDisplacementVisual | null,
  mapClipMask: Container | null,
) {
  const pulse = 0.994 + ((Math.sin(currentTick / 42) + 1) / 2) * 0.01;
  const fadeIn = activeAgeSeconds == null ? 1 : Math.min(1, 0.68 + (activeAgeSeconds / 0.45) * 0.32);
  const fadeOut = remainingSeconds == null ? 1 : Math.max(0.08, Math.min(1, remainingSeconds / 1.25));
  const smokeOpacity = Math.min(fadeIn, fadeOut);
  const growthScale = activeAgeSeconds == null ? 1 : Math.min(1, 0.82 + (activeAgeSeconds / 0.62) * 0.18);
  const cloudScale = growthScale * (0.99 + Math.sin(currentTick / 67) * 0.004);
  const ringColor = utilityTeamAccentColor(throwerSide);
  const footprint = getSmokeFootprint(utilityId, throwerSide);
  const smokeLayer = mapClipMask ? new Container() : layer;
  if (mapClipMask) {
    smokeLayer.mask = mapClipMask;
    layer.addChild(smokeLayer);
  }
  const smokeCloud = new Graphics();
  const smokeWisps = new Graphics();
  const smokePoint = (dx: number, dy: number, phase: number) => ({
    x: point.x + (dx + Math.sin(currentTick / 97 + phase) * 0.34) * cloudScale,
    y: point.y + (dy + Math.cos(currentTick / 109 + phase) * 0.28) * cloudScale,
  });
  const drawSmokeRect = (
    graphics: Graphics,
    dx: number,
    dy: number,
    width: number,
    height: number,
    radius: number,
    color: number,
    alpha: number,
    falloffScale: number,
  ) => {
    const position = smokePoint(dx, dy, dx * 0.11 + dy * 0.07);
    const resolvedAlpha = displacedSmokeAlpha(
      position.x,
      position.y,
      alpha * smokeOpacity,
      displacement,
      falloffScale,
    );
    if (resolvedAlpha <= 0.01) {
      return;
    }
    graphics.roundRect(
      position.x - (width * cloudScale) / 2,
      position.y - (height * cloudScale) / 2,
      width * cloudScale,
      height * cloudScale,
      radius * cloudScale,
    );
    graphics.fill({ color, alpha: resolvedAlpha });
  };
  const drawSmokeEllipse = (
    graphics: Graphics,
    puff: { dx: number; dy: number; width: number; height: number; alpha: number; color: number; phase?: number },
    falloffScale: number,
    widthScale = 1,
    heightScale = 1,
  ) => {
    const position = smokePoint(puff.dx, puff.dy, puff.phase ?? 0);
    const radiusX = puff.width * pulse * cloudScale * widthScale;
    const radiusY = puff.height * pulse * cloudScale * heightScale;
    const alpha = displacedSmokePuffAlpha(
      position.x,
      position.y,
      radiusX,
      radiusY,
      puff.alpha * smokeOpacity,
      displacement,
      falloffScale,
    );
    if (alpha <= 0.01) {
      return;
    }
    graphics.ellipse(position.x, position.y, radiusX, radiusY);
    graphics.fill({ color: puff.color, alpha });
  };

  for (const puff of footprint.shadowPuffs) {
    drawSmokeEllipse(smokeCloud, puff, 1.18, 1.08, 1.08);
  }

  for (const cell of footprint.bodyCells) {
    drawSmokeRect(smokeCloud, cell.dx, cell.dy, cell.width, cell.height, 7, cell.color, cell.alpha, 1.08);
  }
  drawSmokeRect(smokeCloud, 0, 0, 54, 61, 8, 0xb7c1c7, 0.26, 1.02);
  drawSmokeRect(smokeCloud, 0, -1, 40, 47, 7, 0xe3e9ec, 0.23, 0.94);

  for (const puff of footprint.bodyPuffs) {
    drawSmokeEllipse(smokeCloud, puff, 1.02, 1, 1);
  }

  for (const puff of footprint.edgePuffs) {
    drawSmokeEllipse(smokeCloud, puff, 1.08, 1, 1);
  }

  for (const puff of footprint.corePuffs) {
    drawSmokeEllipse(smokeCloud, puff, 0.98, 1, 1);
  }

  for (const wisp of footprint.wisps) {
    const sampleX = point.x + (wisp.sx + wisp.ex) / 2;
    const sampleY = point.y + (wisp.sy + wisp.ey) / 2;
    const alpha = displacedSmokeAlpha(sampleX, sampleY, wisp.alpha * smokeOpacity, displacement, 0.86);
    if (alpha <= 0.01) {
      continue;
    }
    smokeWisps.moveTo(point.x + wisp.sx * cloudScale, point.y + wisp.sy * cloudScale);
    smokeWisps.bezierCurveTo(
      point.x + wisp.c1x * cloudScale,
      point.y + wisp.c1y * cloudScale,
      point.x + wisp.c2x * cloudScale,
      point.y + wisp.c2y * cloudScale,
      point.x + wisp.ex * cloudScale,
      point.y + wisp.ey * cloudScale,
    );
    smokeWisps.stroke({
      color: wisp.color,
      width: wisp.width,
      alpha,
      cap: "round",
      join: "round",
    });
  }

  for (const puff of footprint.highlights) {
    drawSmokeEllipse(smokeCloud, puff, 0.88, 1, 1);
  }

  if (displacement && displacement.ageRatio > 0.06) {
    drawDisplacedSmokeEdge(smokeCloud, point, displacement, smokeOpacity);
  }

  smokeLayer.addChild(smokeCloud);
  smokeLayer.addChild(smokeWisps);

  if (remainingSeconds != null) {
    const progress = Math.max(0, Math.min(1, remainingSeconds / 20));
    drawProgressRing(smokeLayer, { x: point.x + 1, y: point.y }, 16.1, progress, ringColor, {
      backdropAlpha: 0.22,
      backdropColor: 0x050607,
      width: 2.9,
      alpha: 0.96,
    });
  }
}

function drawDisplacedSmokeEdge(
  graphics: Graphics,
  smokeCenter: ScreenPoint,
  displacement: SmokeDisplacementVisual,
  smokeOpacity: number,
) {
  const dx = displacement.center.x - smokeCenter.x;
  const dy = displacement.center.y - smokeCenter.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 0.5) {
    return;
  }

  const strength = Math.max(0, Math.min(1, displacement.ageRatio));
  const directionX = dx / distance;
  const directionY = dy / distance;
  const normalX = -directionY;
  const normalY = directionX;
  const edgeX = displacement.center.x - directionX * displacement.radius * 0.58;
  const edgeY = displacement.center.y - directionY * displacement.radius * 0.58;
  const puffs = [
    { offset: -20, pull: -3, radiusX: 8.5, radiusY: 13.5, alpha: 0.2 },
    { offset: -10, pull: -1, radiusX: 10.5, radiusY: 16.5, alpha: 0.26 },
    { offset: 0, pull: 1, radiusX: 12, radiusY: 18.5, alpha: 0.3 },
    { offset: 11, pull: -1, radiusX: 10, radiusY: 15.5, alpha: 0.24 },
    { offset: 21, pull: -4, radiusX: 7.5, radiusY: 12, alpha: 0.18 },
  ];

  for (const puff of puffs) {
    graphics.ellipse(
      edgeX + normalX * puff.offset - directionX * puff.pull,
      edgeY + normalY * puff.offset - directionY * puff.pull,
      puff.radiusX,
      puff.radiusY,
    );
    graphics.fill({
      color: 0xc9d0d3,
      alpha: puff.alpha * smokeOpacity * strength,
    });
  }

  graphics.ellipse(edgeX - directionX * 5, edgeY - directionY * 5, 18, 25);
  graphics.fill({
    color: 0x919da3,
    alpha: 0.08 * smokeOpacity * strength,
  });
}

function drawFireVisual(
  layer: Container,
  point: ScreenPoint,
  remainingSeconds: number | null,
  throwerSide: "T" | "CT" | null,
  footprint: FireFootprintVisual | null = null,
  currentTick = 0,
) {
  const ringColor = utilityTeamAccentColor(throwerSide);
  if (footprint && footprint.points.length > 0) {
    const burnAgeTicks = Math.max(0, currentTick - footprint.firstSampleTick);
    const fadeInIntensity = Math.min(1, 0.38 + (burnAgeTicks / 18) * 0.62);
    const fadeOutIntensity = remainingSeconds == null ? 1 : Math.max(0.08, Math.min(1, remainingSeconds / 0.85));
    const footprintIntensity = Math.min(fadeInIntensity, fadeOutIntensity);
    drawFireFootprintVisual(layer, footprint.points, ringColor, footprintIntensity);
  } else {
    drawSingleFireVisual(layer, point, ringColor);
  }

  if (remainingSeconds != null) {
    const progress = Math.max(0, Math.min(1, remainingSeconds / 7));
    drawProgressRing(layer, { x: point.x + 1, y: point.y + 1 }, 18.5, progress, ringColor, {
      backdropAlpha: 0.08,
      backdropColor: ringColor,
      width: 2.7,
      alpha: 0.8,
    });
  }
}

function drawFireFootprintVisual(
  layer: Container,
  footprintPoints: ScreenPoint[],
  _ringColor: number,
  intensity: number,
) {
  const clampedIntensity = Math.max(0.05, Math.min(1, intensity));
  const heat = new Graphics();
  const core = new Graphics();
  const ember = new Graphics();

  for (const point of footprintPoints) {
    heat.circle(point.x, point.y, 13.5);
    heat.fill({ color: 0xff7d2d, alpha: 0.22 * clampedIntensity });
    heat.circle(point.x + 1.5, point.y - 1.5, 9.2);
    heat.fill({ color: 0xffa642, alpha: 0.34 * clampedIntensity });

    core.circle(point.x, point.y, 5.7);
    core.fill({ color: 0xffcf72, alpha: 0.62 * clampedIntensity });
    core.circle(point.x + 1.2, point.y - 1.6, 3.1);
    core.fill({ color: 0xfff0c6, alpha: 0.46 * clampedIntensity });

    ember.circle(point.x - 4.8, point.y + 3.5, 1.1);
    ember.fill({ color: 0xffe1af, alpha: 0.34 * clampedIntensity });
    ember.circle(point.x + 4.6, point.y - 3.3, 0.9);
    ember.fill({ color: 0xffefcf, alpha: 0.28 * clampedIntensity });
  }

  layer.addChild(heat);
  layer.addChild(core);
  layer.addChild(ember);
}

function drawSingleFireVisual(layer: Container, point: ScreenPoint, ringColor: number) {
  const field = new Graphics();
  field.circle(point.x, point.y, 16.5);
  field.fill({ color: 0xff8f2f, alpha: 0.15 });
  field.circle(point.x, point.y, 12.2);
  field.fill({ color: 0xffb24c, alpha: 0.22 });
  field.circle(point.x, point.y, 7.2);
  field.fill({ color: 0xffdf8e, alpha: 0.34 });
  field.circle(point.x, point.y, 3.8);
  field.fill({ color: 0xfff0bf, alpha: 0.55 });
  field.circle(point.x, point.y, 17.8);
  field.stroke({ color: ringColor, width: 2.15, alpha: 0.62 });
  field.circle(point.x, point.y, 10.2);
  field.stroke({ color: 0xffd27a, width: 1, alpha: 0.26 });
  layer.addChild(field);
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
  const iconDefinition = utilitySvgIcon(kind);
  const teamAccent = utilityTeamAccentColor(throwerSide);
  const maxWidth = 15;
  const maxHeight = 16;
  const iconScale = Math.min(maxWidth / iconDefinition.width, maxHeight / iconDefinition.height);
  const icon = createEquipmentIconGraphic(
    iconDefinition,
    point.x,
    point.y,
    iconScale,
    teamAccent,
    throwerSide == null ? 0.82 : 0.96,
  );

  layer.addChild(icon);
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
    const teamAccent = utilityTeamAccentColor(throwerSide);
    trail.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index += 1) {
      trail.lineTo(points[index].x, points[index].y);
    }
    trail.stroke({
      color: 0x020507,
      width: 3.2,
      alpha: 0.46,
      cap: "round",
      join: "round",
    });
    trail.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index += 1) {
      trail.lineTo(points[index].x, points[index].y);
    }
    trail.stroke({
      color: teamAccent,
      width: 1.45,
      alpha: 0.78,
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

  const teamAccent = utilityTeamAccentColor(throwerSide);
  const bounceMarkers = new Graphics();
  for (const point of bouncePoints) {
    bounceMarkers.circle(point.x, point.y, 6.5);
    bounceMarkers.stroke({ color: 0x020507, width: 2.8, alpha: 0.5 });
    bounceMarkers.circle(point.x, point.y, 5.9);
    bounceMarkers.stroke({ color: teamAccent, width: 1.35, alpha: 0.72 });
    bounceMarkers.circle(point.x, point.y, 1.6);
    bounceMarkers.fill({ color: teamAccent, alpha: 0.82 });
  }
  layer.addChild(bounceMarkers);
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

  const clearStrength = Math.max(0, Math.min(0.94, displacement.ageRatio));
  if (distance <= displacement.radius * 0.66) {
    return Math.max(baseAlpha * 0.06, baseAlpha * (1 - clearStrength * 0.92));
  }

  const openness = 1 - distance / Math.max(1, falloffRadius);
  const reduction = Math.min(0.78, 1.02 * clearStrength * Math.pow(openness, 0.96));
  return Math.max(baseAlpha * 0.18, baseAlpha * (1 - reduction));
}

function displacedSmokePuffAlpha(
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
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
  const puffReach = Math.min(radiusX, radiusY) * 0.72;
  const clearStrength = Math.max(0, Math.min(0.96, displacement.ageRatio));
  const hardClearRadius = displacement.radius * 0.68 + puffReach * 0.68;
  const falloffRadius = displacement.radius * falloffScale + puffReach;

  if (distance >= falloffRadius) {
    return baseAlpha;
  }

  if (distance <= hardClearRadius) {
    return Math.max(baseAlpha * 0.04, baseAlpha * (1 - clearStrength * 0.94));
  }

  const openness = 1 - (distance - hardClearRadius) / Math.max(1, falloffRadius - hardClearRadius);
  const reduction = Math.min(0.8, 1.04 * clearStrength * Math.pow(openness, 0.98));
  return Math.max(baseAlpha * 0.16, baseAlpha * (1 - reduction));
}

function trajectoryTrailPoints(
  replay: Replay,
  utility: UtilityEntity,
  currentTick: number,
  radarViewport: RadarViewport,
  sampleStride = 1,
  options?: {
    clampToActivation?: boolean;
  },
) {
  const endTick =
    options?.clampToActivation === false
      ? currentTick
      : Math.min(currentTick, utilityActivationTick(utility) ?? utilityLifecycleEndTick(utility));
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
    return emphasize ? "primary" : "minimal";
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
      return emphasize ? 0.38 : 0.19;
    }

    return emphasize ? 0.34 : 0.2;
  }

  return emphasize ? 0.62 : 0.22;
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

function resolveFireFootprintVisual(
  replay: Replay,
  utility: UtilityEntity,
  currentTick: number,
  radarViewport: RadarViewport,
) {
  const samples = utility.fireFootprint ?? [];
  if (samples.length === 0) {
    return null;
  }

  let sample: (typeof samples)[number] | null = null;
  let firstSampleTick: number | null = null;
  for (const candidate of samples) {
    if (candidate.tick > currentTick) {
      continue;
    }

    if (firstSampleTick == null || candidate.tick < firstSampleTick) {
      firstSampleTick = candidate.tick;
    }

    if (!sample || candidate.tick > sample.tick) {
      sample = candidate;
    }
  }

  if (!sample) {
    return null;
  }

  const count = Math.min(sample.x.length, sample.y.length, sample.z.length);
  const points: ScreenPoint[] = [];
  for (let index = 0; index < count; index += 1) {
    const x = sample.x[index];
    const y = sample.y[index];
    if (x == null || y == null || !isWorldPointNearMap(replay, x, y)) {
      continue;
    }

    const point = worldToScreen(replay, radarViewport, x, y);
    if (isScreenPointVisible(point, radarViewport)) {
      points.push(point);
    }
  }

  return {
    firstSampleTick: firstSampleTick ?? sample.tick,
    points,
    sampleTick: sample.tick,
  };
}

function resolveUtilityAtlasOutcomePoint(
  replay: Replay,
  utility: UtilityEntity,
  radarViewport: RadarViewport,
) {
  if (utility.kind === "smoke") {
    return resolveSmokeActivePoint(replay, utility, radarViewport, resolveSmokeDetonationTick(utility));
  }

  if (utility.kind === "molotov" || utility.kind === "incendiary") {
    const firePoint = resolveFirstVisibleUtilityPhasePoint(replay, utility, radarViewport, "detonate");
    if (firePoint) {
      return firePoint;
    }
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

function resolveFirstVisibleUtilityPhasePoint(
  replay: Replay,
  utility: UtilityEntity,
  radarViewport: RadarViewport,
  phaseType: UtilityEntity["phaseEvents"][number]["type"],
) {
  const event = [...utility.phaseEvents]
    .filter((phaseEvent) => phaseEvent.type === phaseType && phaseEvent.x != null && phaseEvent.y != null)
    .sort((left, right) => right.tick - left.tick)[0];

  if (event?.x == null || event.y == null) {
    return null;
  }

  const phasePoint = worldToScreen(replay, radarViewport, event.x, event.y);
  return isScreenPointVisible(phasePoint, radarViewport) ? phasePoint : null;
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
  const openRatio = Math.min(1, elapsedRatio / 0.16);
  const refillRatio = Math.max(0, Math.min(1, (elapsedRatio - 0.36) / 0.64));
  const ageRatio = Math.pow(openRatio, 0.55) * Math.pow(1 - refillRatio, 1.45);

  return {
    ageRatio,
    center,
    radius: 22 + ageRatio * 18,
  };
}
