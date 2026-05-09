import { Circle, Container, Graphics, Text } from "pixi.js";

import type { RadarViewport } from "../maps/transform";
import { worldToScreen } from "../maps/transform";
import { normalizeUtilityVisualKind } from "../replay/utilityPresentation";
import type { Replay, UtilityEntity } from "../replay/types";
import decoyIconSvg from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/decoy.svg?raw";
import flashbangIconSvg from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/flashbang.svg?raw";
import hegrenadeIconSvg from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/hegrenade.svg?raw";
import molotovIconSvg from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/molotov.svg?raw";
import smokegrenadeIconSvg from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/smokegrenade.svg?raw";
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

type UtilitySvgIcon = {
  height: number;
  svg: string;
  width: number;
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

function utilitySvgIcon(kind: UtilityEntity["kind"]): UtilitySvgIcon {
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
  const icon = new Graphics();
  const maxWidth = emphasize ? 15.8 : 13.4;
  const maxHeight = emphasize ? 16.8 : 14.2;
  const iconScale = Math.min(maxWidth / iconDefinition.width, maxHeight / iconDefinition.height);

  icon.svg(iconDefinition.svg);
  icon.pivot.set(iconDefinition.width / 2, iconDefinition.height / 2);
  icon.position.set(point.x, point.y);
  icon.scale.set(iconScale);
  icon.tint = style.endpointColor;
  icon.alpha = endpointAlpha ?? (emphasize ? 0.98 : 0.9);

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
  hitTarget.eventMode = "static";
  hitTarget.cursor = "pointer";
  hitTarget.hitArea = new Circle(
    point.x,
    point.y,
    kind === "smoke" || kind === "molotov" || kind === "incendiary" ? 22 : 19,
  );
  hitTarget.on("pointertap", (event) => {
    event.stopPropagation();
  });
  hitTarget.on("pointerdown", (event) => {
    const nativeEvent = event.nativeEvent as (PointerEvent & { __drIgnoreStagePan?: boolean }) | undefined;
    if (nativeEvent) {
      nativeEvent.__drIgnoreStagePan = true;
      nativeEvent.preventDefault();
    }
    event.stopPropagation();
    onSelect();
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
  const cloudScale = 0.96 + ((Math.sin(currentTick / 67) + 1) / 2) * 0.018;
  const ringColor = utilityTeamAccentColor(throwerSide);
  const volumeWidth = 48 * cloudScale;
  const volumeHeight = 63 * cloudScale;
  const smokeLayer = mapClipMask ? new Container() : layer;
  if (mapClipMask) {
    smokeLayer.mask = mapClipMask;
    layer.addChild(smokeLayer);
  }
  const smokeVeil = new Graphics();
  const cloudShadow = new Graphics();
  const smokeBlock = new Graphics();
  const smokeBody = new Graphics();
  const smokeMass = new Graphics();
  const smokeCore = new Graphics();
  const smokeWisps = new Graphics();
  const smokeHighlights = new Graphics();
  const smokePoint = (dx: number, dy: number, phase: number) => ({
    x: point.x + (dx + Math.sin(currentTick / 83 + phase) * 0.22) * cloudScale,
    y: point.y + (dy + Math.cos(currentTick / 91 + phase) * 0.18) * cloudScale,
  });
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
    const shadowPuffs = [
    { dx: -17, dy: 24, width: 18, height: 11, alpha: 0.15, color: 0x050709, phase: 0.2 },
    { dx: 0, dy: 27, width: 26, height: 12, alpha: 0.16, color: 0x050709, phase: 1.8 },
    { dx: 17, dy: 23, width: 18, height: 11, alpha: 0.14, color: 0x050709, phase: 3.4 },
    { dx: -1, dy: 8, width: 38, height: 24, alpha: 0.11, color: 0x050709, phase: 4.5 },
  ];
  const veilPuffs = [
    { dx: -18, dy: -27, width: 16, height: 14, alpha: 0.39, color: 0x9ba5ab, phase: 0.4 },
    { dx: -3, dy: -29, width: 21, height: 15, alpha: 0.42, color: 0xb7c0c5, phase: 1.1 },
    { dx: 15, dy: -27, width: 18, height: 14, alpha: 0.39, color: 0xa2acb2, phase: 1.7 },
    { dx: -24, dy: -15, width: 16, height: 15, alpha: 0.38, color: 0x8d989f, phase: 2.4 },
    { dx: 23, dy: -15, width: 16, height: 15, alpha: 0.39, color: 0x98a3aa, phase: 2.9 },
    { dx: -24, dy: 0, width: 16, height: 16, alpha: 0.38, color: 0x87939a, phase: 3.6 },
    { dx: 24, dy: 1, width: 16, height: 16, alpha: 0.38, color: 0x96a1a8, phase: 5.0 },
    { dx: -21, dy: 16, width: 16, height: 15, alpha: 0.36, color: 0x8f9aa1, phase: 5.7 },
    { dx: 20, dy: 17, width: 16, height: 15, alpha: 0.35, color: 0x929da4, phase: 6.2 },
    { dx: -3, dy: 27, width: 22, height: 15, alpha: 0.39, color: 0xaab4ba, phase: 4.3 },
  ];
  const bodyPuffs = [
    { dx: -12, dy: -20, width: 20, height: 17, alpha: 0.58, color: 0xaab4ba, phase: 0.8 },
    { dx: 4, dy: -21, width: 22, height: 17, alpha: 0.64, color: 0xd2dade, phase: 1.5 },
    { dx: 17, dy: -14, width: 18, height: 16, alpha: 0.55, color: 0xb6c0c6, phase: 2.1 },
    { dx: -19, dy: -8, width: 19, height: 17, alpha: 0.54, color: 0x98a4ab, phase: 2.8 },
    { dx: -6, dy: -7, width: 23, height: 19, alpha: 0.67, color: 0xcbd3d8, phase: 3.5 },
    { dx: 8, dy: -6, width: 23, height: 19, alpha: 0.67, color: 0xe0e6e9, phase: 4.2 },
    { dx: 19, dy: 3, width: 18, height: 17, alpha: 0.52, color: 0xaab5bb, phase: 4.8 },
    { dx: -19, dy: 8, width: 19, height: 17, alpha: 0.52, color: 0x98a4ab, phase: 5.5 },
    { dx: -4, dy: 8, width: 24, height: 19, alpha: 0.65, color: 0xc2cbd0, phase: 6.1 },
    { dx: 11, dy: 11, width: 22, height: 18, alpha: 0.61, color: 0xd0d8dc, phase: 6.8 },
    { dx: -12, dy: 23, width: 19, height: 15, alpha: 0.47, color: 0x98a4ab, phase: 7.4 },
    { dx: 5, dy: 25, width: 19, height: 15, alpha: 0.5, color: 0xb3bdc3, phase: 8.1 },
  ];
  const puffs = [
    { dx: -10, dy: -18, width: 11, height: 10, alpha: 0.54, color: 0xc4ccd1, phase: 0.2 },
    { dx: 1, dy: -19, width: 12, height: 10, alpha: 0.6, color: 0xe9eef1, phase: 0.9 },
    { dx: 12, dy: -16, width: 11, height: 10, alpha: 0.54, color: 0xd1d9dd, phase: 1.4 },
    { dx: -15, dy: -8, width: 11, height: 11, alpha: 0.5, color: 0xaab5bc, phase: 2.0 },
    { dx: -5, dy: -8, width: 13, height: 11, alpha: 0.62, color: 0xd9e0e3, phase: 2.6 },
    { dx: 6, dy: -8, width: 14, height: 11, alpha: 0.64, color: 0xf0f4f6, phase: 3.1 },
    { dx: 16, dy: -6, width: 11, height: 10, alpha: 0.5, color: 0xbac4ca, phase: 3.7 },
    { dx: -15, dy: 2, width: 11, height: 11, alpha: 0.49, color: 0x9ca8af, phase: 4.3 },
    { dx: -4, dy: 2, width: 14, height: 12, alpha: 0.66, color: 0xe5eaed, phase: 4.8 },
    { dx: 7, dy: 2, width: 14, height: 12, alpha: 0.63, color: 0xdce3e6, phase: 5.4 },
    { dx: 17, dy: 4, width: 10, height: 10, alpha: 0.46, color: 0xaab5bb, phase: 6.0 },
    { dx: -11, dy: 13, width: 11, height: 10, alpha: 0.46, color: 0xb0bac0, phase: 6.6 },
    { dx: 1, dy: 13, width: 13, height: 11, alpha: 0.54, color: 0xd1d9dd, phase: 7.2 },
    { dx: 13, dy: 13, width: 11, height: 10, alpha: 0.46, color: 0xb7c1c7, phase: 7.8 },
  ];
  const corePuffs = [
    { dx: -4, dy: -8, width: 10, height: 8, alpha: 0.34, color: 0xffffff, phase: 0.6 },
    { dx: 5, dy: -7, width: 10, height: 8, alpha: 0.32, color: 0xffffff, phase: 1.9 },
    { dx: -1, dy: 2, width: 12, height: 9, alpha: 0.31, color: 0xfbfeff, phase: 3.2 },
    { dx: 7, dy: 6, width: 9, height: 8, alpha: 0.22, color: 0xe4ecef, phase: 4.4 },
  ];
  const highlights = [
    { dx: -8, dy: -12, width: 5, height: 3, alpha: 0.11, color: 0xffffff, phase: 0.5 },
    { dx: 7, dy: -10, width: 5, height: 3, alpha: 0.1, color: 0xffffff, phase: 2.1 },
    { dx: 2, dy: 6, width: 6, height: 4, alpha: 0.1, color: 0xf8fbfe, phase: 3.8 },
  ];
  const wisps = [
    { sx: -15, sy: -9, c1x: -6, c1y: -16, c2x: 5, c2y: -2, ex: 15, ey: -10, alpha: 0.14, width: 1.7, color: 0xf5f8fa },
    { sx: -14, sy: 5, c1x: -5, c1y: -3, c2x: 6, c2y: 12, ex: 15, ey: 4, alpha: 0.13, width: 1.6, color: 0xe9eef1 },
    { sx: -7, sy: -16, c1x: 2, c1y: -21, c2x: 8, c2y: -7, ex: 15, ey: -14, alpha: 0.1, width: 1.35, color: 0xf7fafc },
    { sx: -12, sy: 13, c1x: -3, c1y: 7, c2x: 7, c2y: 18, ex: 14, ey: 10, alpha: 0.08, width: 2.2, color: 0x6e7f88 },
    { sx: -13, sy: -2, c1x: -4, c1y: 7, c2x: 5, c2y: -8, ex: 14, ey: 1, alpha: 0.08, width: 2.3, color: 0x596872 },
  ];

  for (const puff of shadowPuffs) {
    drawSmokeEllipse(cloudShadow, puff, 1.14, 1, 1);
  }
  smokeLayer.addChild(cloudShadow);

  if (!displacement || displacement.ageRatio < 0.12) {
    smokeBlock.roundRect(point.x - volumeWidth / 2, point.y - volumeHeight / 2, volumeWidth, volumeHeight, 7 * cloudScale);
    smokeBlock.fill({ color: 0x929da3, alpha: 0.68 * smokeOpacity });
    smokeBlock.roundRect(
      point.x - volumeWidth * 0.42,
      point.y - volumeHeight * 0.42,
      volumeWidth * 0.84,
      volumeHeight * 0.84,
      6 * cloudScale,
    );
    smokeBlock.fill({ color: 0xc3ccd1, alpha: 0.54 * smokeOpacity });
    smokeBlock.roundRect(
      point.x - volumeWidth * 0.3,
      point.y - volumeHeight * 0.31,
      volumeWidth * 0.6,
      volumeHeight * 0.62,
      5 * cloudScale,
    );
    smokeBlock.fill({ color: 0xe8edf0, alpha: 0.32 * smokeOpacity });
    smokeLayer.addChild(smokeBlock);
  }

  for (const puff of bodyPuffs) {
    drawSmokeEllipse(smokeBody, puff, 1.08, 1, 1);
  }
  smokeLayer.addChild(smokeBody);

  for (const puff of veilPuffs) {
    drawSmokeEllipse(smokeVeil, puff, 1.05, 1, 1);
  }
  smokeLayer.addChild(smokeVeil);

  for (const puff of puffs) {
    drawSmokeEllipse(smokeMass, puff, 1, 1, 1);
  }
  smokeLayer.addChild(smokeMass);

  for (const puff of corePuffs) {
    drawSmokeEllipse(smokeCore, puff, 0.95, 1, 1);
  }
  smokeLayer.addChild(smokeCore);

  for (const wisp of wisps) {
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
  smokeLayer.addChild(smokeWisps);

  for (const puff of highlights) {
    drawSmokeEllipse(smokeHighlights, puff, 0.88, 1, 1);
  }
  smokeLayer.addChild(smokeHighlights);

  if (remainingSeconds != null) {
    const progress = Math.max(0, Math.min(1, remainingSeconds / 20));
    drawProgressRing(smokeLayer, { x: point.x + 1, y: point.y }, 15.2, progress, ringColor, {
      backdropAlpha: 0.12,
      backdropColor: 0x121619,
      width: 2.6,
      alpha: 0.82,
    });
  }
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
  const icon = new Graphics();
  const teamAccent = utilityTeamAccentColor(throwerSide);
  const maxWidth = 15;
  const maxHeight = 16;
  const iconScale = Math.min(maxWidth / iconDefinition.width, maxHeight / iconDefinition.height);

  icon.svg(iconDefinition.svg);
  icon.pivot.set(iconDefinition.width / 2, iconDefinition.height / 2);
  icon.position.set(point.x, point.y);
  icon.scale.set(iconScale);
  icon.tint = teamAccent;
  icon.alpha = throwerSide == null ? 0.82 : 0.96;

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

  const clearStrength = Math.max(0, Math.min(1, displacement.ageRatio));
  if (distance <= displacement.radius * 0.56) {
    return Math.max(0, baseAlpha * (1 - clearStrength));
  }

  const openness = 1 - distance / Math.max(1, falloffRadius);
  const reduction = Math.min(1, 1.35 * clearStrength * Math.pow(openness, 0.82));
  return Math.max(0, baseAlpha * (1 - reduction));
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
  const clearStrength = Math.max(0, Math.min(1, displacement.ageRatio));
  const hardClearRadius = displacement.radius * 0.74 + puffReach;
  const falloffRadius = displacement.radius * falloffScale + puffReach;

  if (distance >= falloffRadius) {
    return baseAlpha;
  }

  if (distance <= hardClearRadius) {
    return Math.max(0, baseAlpha * (1 - clearStrength));
  }

  const openness = 1 - (distance - hardClearRadius) / Math.max(1, falloffRadius - hardClearRadius);
  const reduction = Math.min(1, 1.28 * clearStrength * Math.pow(openness, 0.86));
  return Math.max(0, baseAlpha * (1 - reduction));
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
  let ageRatio = 1;
  if (elapsedRatio > 0.55) {
    const refillRatio = Math.min(1, (elapsedRatio - 0.55) / 0.45);
    ageRatio = Math.pow(1 - refillRatio, 1.8);
  }

  return {
    ageRatio,
    center,
    radius: 15 + ageRatio * 14,
  };
}
