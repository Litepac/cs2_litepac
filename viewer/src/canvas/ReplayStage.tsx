import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Application, Assets, Container, Graphics, Rectangle, Sprite, Text, Texture } from "pixi.js";

import { drawUtilityVisual } from "./utilityVisuals";
import { createRadarViewport, loadRadarImageSize, type RadarViewport, worldToScreen } from "../maps/transform";
import { utilityMatchesFocus, type UtilityFocus } from "../replay/utilityFilter";
import type { Replay, Round } from "../replay/types";

type Props = {
  currentTick: number;
  replay: Replay;
  round: Round;
  selectedPlayerId: string | null;
  utilityFocus: UtilityFocus;
  onSelectPlayer: (playerId: string) => void;
};

type StageState = {
  app: Application;
  sceneRoot: Container;
  mapLayer: Container;
  utilityOverlayLayer: Container;
  utilityTrailLayer: Container;
  bombLayer: Container;
  killLayer: Container;
  trailLayer: Container;
  playerLayer: Container;
  eventLayer: Container;
  currentMapKey: string | null;
  currentViewportHeight: number | null;
  currentViewportWidth: number | null;
  lastFullRenderTick: number | null;
  lastRoundNumber: number | null;
  lastSelectedPlayerId: string | null;
  radarViewport: RadarViewport | null;
  cameraOffsetX: number;
  cameraOffsetY: number;
  cameraScale: number;
};

const DEFAULT_STAGE_WIDTH = 1180;
const DEFAULT_STAGE_HEIGHT = 760;
const MIN_STAGE_WIDTH = 680;
const MIN_STAGE_HEIGHT = 420;
const RECENT_HURT_WINDOW_TICKS = 64 * 2;
const RECENT_KILL_WINDOW_TICKS = 64 * 6;
const RECENT_BOMB_WINDOW_TICKS = 64 * 8;
export function ReplayStage({
  currentTick,
  replay,
  round,
  selectedPlayerId,
  utilityFocus,
  onSelectPlayer,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<StageState | null>(null);
  const playerById = useMemo(() => new Map(replay.players.map((player) => [player.playerId, player])), [replay.players]);
  const currentTickRef = useRef(currentTick);
  const replayRef = useRef(replay);
  const roundRef = useRef(round);
  const playerByIdRef = useRef(playerById);
  const selectedPlayerIdRef = useRef(selectedPlayerId);
  const utilityFocusRef = useRef(utilityFocus);
  const onSelectPlayerRef = useRef(onSelectPlayer);
  const renderErrorRef = useRef<string | null>(null);
  const [stageRevision, setStageRevision] = useState(0);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [viewportSize, setViewportSize] = useState({
    height: DEFAULT_STAGE_HEIGHT,
    width: DEFAULT_STAGE_WIDTH,
  });

  function syncViewportSizeFromHost(hostElement: HTMLDivElement) {
    const bounds = hostElement.getBoundingClientRect();
    const nextViewportSize = resolveViewportDimensions(bounds.width, bounds.height);
    setViewportSize((value) =>
      value.width === nextViewportSize.width && value.height === nextViewportSize.height ? value : nextViewportSize,
    );

    const stage = stageRef.current;
    if (stage) {
      stage.app.renderer.resize(nextViewportSize.width, nextViewportSize.height);
      applyCameraTransform(stage);
      setStageRevision((value) => value + 1);
    }
  }

  useEffect(() => {
    currentTickRef.current = currentTick;
    replayRef.current = replay;
    roundRef.current = round;
    playerByIdRef.current = playerById;
    selectedPlayerIdRef.current = selectedPlayerId;
    utilityFocusRef.current = utilityFocus;
    onSelectPlayerRef.current = onSelectPlayer;
  }, [currentTick, onSelectPlayer, playerById, replay, round, selectedPlayerId, utilityFocus]);

  useLayoutEffect(() => {
    if (!hostRef.current) {
      return;
    }

    const hostElement = hostRef.current;
    let frameA: number | null = null;
    let frameB: number | null = null;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      syncViewportSizeFromHost(hostElement);
    });

    observer.observe(hostElement);
    syncViewportSizeFromHost(hostElement);
    frameA = window.requestAnimationFrame(() => {
      syncViewportSizeFromHost(hostElement);
      frameB = window.requestAnimationFrame(() => syncViewportSizeFromHost(hostElement));
    });

    return () => {
      observer.disconnect();
      if (frameA != null) {
        window.cancelAnimationFrame(frameA);
      }
      if (frameB != null) {
        window.cancelAnimationFrame(frameB);
      }
    };
  }, []);

  useEffect(() => {
    if (!hostRef.current) {
      return;
    }

    const hostElement = hostRef.current;
    let frameA: number | null = window.requestAnimationFrame(() => syncViewportSizeFromHost(hostElement));
    let frameB: number | null = null;
    const timeoutId = window.setTimeout(() => {
      frameB = window.requestAnimationFrame(() => syncViewportSizeFromHost(hostElement));
    }, 60);

    return () => {
      if (frameA != null) {
        window.cancelAnimationFrame(frameA);
      }
      if (frameB != null) {
        window.cancelAnimationFrame(frameB);
      }
      window.clearTimeout(timeoutId);
    };
  }, [replay.sourceDemo.fileName, round.roundNumber]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!hostRef.current || stageRef.current) {
        return;
      }

      const app = new Application();
      await app.init({
        width: DEFAULT_STAGE_WIDTH,
        height: DEFAULT_STAGE_HEIGHT,
        antialias: true,
        backgroundAlpha: 0,
      });

      if (cancelled) {
        app.destroy(true, { children: true });
        return;
      }

      const sceneRoot = new Container();
      const mapLayer = new Container();
      const utilityTrailLayer = new Container();
      utilityTrailLayer.visible = false;
      const bombLayer = new Container();
      const killLayer = new Container();
      const trailLayer = new Container();
      const playerLayer = new Container();
      const eventLayer = new Container();
      const utilityOverlayLayer = new Container();
      sceneRoot.addChild(
        mapLayer,
        utilityTrailLayer,
        bombLayer,
        killLayer,
        trailLayer,
        eventLayer,
        playerLayer,
        utilityOverlayLayer,
      );
      app.stage.addChild(sceneRoot);

      hostRef.current.appendChild(app.canvas);
      stageRef.current = {
        app,
        sceneRoot,
        mapLayer,
        utilityOverlayLayer,
        utilityTrailLayer,
        bombLayer,
        killLayer,
        trailLayer,
        playerLayer,
        eventLayer,
        currentMapKey: null,
        currentViewportHeight: null,
        currentViewportWidth: null,
        lastFullRenderTick: null,
        lastRoundNumber: null,
        lastSelectedPlayerId: null,
        radarViewport: null,
        cameraOffsetX: 0,
        cameraOffsetY: 0,
        cameraScale: 1,
      };
      syncViewportSizeFromHost(hostRef.current);
      setStageRevision((value) => value + 1);
    }

    void init();

    return () => {
      cancelled = true;
      if (stageRef.current) {
        stageRef.current.app.destroy(true, { children: true });
        stageRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }

    stage.app.renderer.resize(viewportSize.width, viewportSize.height);
    applyCameraTransform(stage);
    setStageRevision((value) => value + 1);
  }, [viewportSize]);

  useEffect(() => {
    if (hostRef.current == null || stageRef.current == null) {
      return;
    }
    const hostElement = hostRef.current;
    const activeStage = stageRef.current;

    let dragging = false;
    let lastClientX = 0;
    let lastClientY = 0;

    function onWheel(event: WheelEvent) {
      event.preventDefault();
      const direction = event.deltaY > 0 ? -1 : 1;
      const nextScale = clamp(activeStage.cameraScale + direction * 0.12, 1, 2.6);
      if (nextScale === activeStage.cameraScale) {
        return;
      }

      activeStage.cameraScale = nextScale;
      applyCameraTransform(activeStage);
    }

    function onPointerDown(event: PointerEvent) {
      dragging = true;
      lastClientX = event.clientX;
      lastClientY = event.clientY;
      hostElement.setPointerCapture(event.pointerId);
    }

    function onPointerMove(event: PointerEvent) {
      if (!dragging) {
        return;
      }

      activeStage.cameraOffsetX += event.clientX - lastClientX;
      activeStage.cameraOffsetY += event.clientY - lastClientY;
      lastClientX = event.clientX;
      lastClientY = event.clientY;
      applyCameraTransform(activeStage);
    }

    function onPointerUp(event: PointerEvent) {
      dragging = false;
      if (hostElement.hasPointerCapture(event.pointerId)) {
        hostElement.releasePointerCapture(event.pointerId);
      }
    }

    function onDoubleClick() {
      activeStage.cameraScale = 1;
      activeStage.cameraOffsetX = 0;
      activeStage.cameraOffsetY = 0;
      applyCameraTransform(activeStage);
    }

    hostElement.addEventListener("wheel", onWheel, { passive: false });
    hostElement.addEventListener("pointerdown", onPointerDown);
    hostElement.addEventListener("pointermove", onPointerMove);
    hostElement.addEventListener("pointerup", onPointerUp);
    hostElement.addEventListener("pointerleave", onPointerUp);
    hostElement.addEventListener("dblclick", onDoubleClick);

    return () => {
      hostElement.removeEventListener("wheel", onWheel);
      hostElement.removeEventListener("pointerdown", onPointerDown);
      hostElement.removeEventListener("pointermove", onPointerMove);
      hostElement.removeEventListener("pointerup", onPointerUp);
      hostElement.removeEventListener("pointerleave", onPointerUp);
      hostElement.removeEventListener("dblclick", onDoubleClick);
    };
  }, [stageRevision]);

  useEffect(() => {
    let cancelled = false;

    async function prepareStage() {
      const stage = stageRef.current;
      if (!stage) {
        return;
      }

      try {
        await ensureStageMap(stage, replayRef.current, viewportSize.width, viewportSize.height);
        if (!cancelled) {
          setRenderError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setRenderError(error instanceof Error ? error.message : String(error));
        }
      }
    }

    void prepareStage();

    return () => {
      cancelled = true;
    };
  }, [stageRevision, viewportSize, replay.map.radarImageKey]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage?.radarViewport) {
      return;
    }

    try {
      renderDynamicFrame(
        stage,
        replayRef.current,
        roundRef.current,
        currentTickRef.current,
        selectedPlayerIdRef.current,
        utilityFocusRef.current,
        playerByIdRef.current,
        onSelectPlayerRef.current,
      );
      if (renderErrorRef.current != null) {
        renderErrorRef.current = null;
        setRenderError(null);
      }
    } catch (error) {
      const nextError = error instanceof Error ? error.message : String(error);
      if (renderErrorRef.current !== nextError) {
        renderErrorRef.current = nextError;
        setRenderError(nextError);
      }
    }
  }, [currentTick, stageRevision, replay, round, selectedPlayerId, utilityFocus, playerById]);

  return (
    <div className="stage-shell">
      <div className="stage" ref={hostRef} />
      {renderError ? <div className="stage-error">{renderError}</div> : null}
    </div>
  );
}

async function ensureStageMap(
  stage: StageState,
  replay: Replay,
  viewportWidth: number,
  viewportHeight: number,
) {
  if (
    stage.currentMapKey === replay.map.radarImageKey &&
    stage.currentViewportWidth === viewportWidth &&
    stage.currentViewportHeight === viewportHeight &&
    stage.radarViewport != null
  ) {
    return;
  }

  const radarURL = radarImageURL(replay.map.radarImageKey);
  const radarSize = await loadRadarImageSize(radarURL);
  const radarViewport = createRadarViewport(
    replay,
    viewportWidth,
    viewportHeight,
    radarSize.imageWidth,
    radarSize.imageHeight,
    radarSize.cropLeft,
    radarSize.cropTop,
    radarSize.cropWidth,
    radarSize.cropHeight,
  );
  stage.mapLayer.removeChildren().forEach((child) => child.destroy());
  const texture = await Assets.load(radarURL);
  const croppedTexture = new Texture({
    frame: new Rectangle(
      radarViewport.cropLeft,
      radarViewport.cropTop,
      radarViewport.cropWidth,
      radarViewport.cropHeight,
    ),
    source: texture.source,
  });
  const sprite = new Sprite(croppedTexture);
  sprite.x = radarViewport.offsetX + radarViewport.cropLeft * radarViewport.scale;
  sprite.y = radarViewport.offsetY + radarViewport.cropTop * radarViewport.scale;
  sprite.width = radarViewport.cropWidth * radarViewport.scale;
  sprite.height = radarViewport.cropHeight * radarViewport.scale;
  stage.mapLayer.addChild(sprite);
  stage.currentMapKey = replay.map.radarImageKey;
  stage.currentViewportWidth = viewportWidth;
  stage.currentViewportHeight = viewportHeight;
  stage.lastFullRenderTick = null;
  stage.lastRoundNumber = null;
  stage.lastSelectedPlayerId = null;
  stage.radarViewport = radarViewport;
  applyCameraTransform(stage);
}

function renderDynamicFrame(
  stage: StageState,
  replay: Replay,
  round: Round,
  currentTick: number,
  selectedPlayerId: string | null,
  utilityFocus: UtilityFocus,
  playerById: Map<string, Replay["players"][number]>,
  onSelectPlayer: (playerId: string) => void,
) {
  const radarViewport = stage.radarViewport;
  if (!radarViewport) {
    return;
  }

  const tickRate = replay.match.tickRate || replay.sourceDemo.tickRate || 64;
  const fullRenderTick = Math.floor(currentTick);
  const needsFullRender =
    stage.lastFullRenderTick !== fullRenderTick ||
    stage.lastRoundNumber !== round.roundNumber ||
    stage.lastSelectedPlayerId !== selectedPlayerId;

  stage.utilityTrailLayer.removeChildren().forEach((child) => child.destroy());
  stage.utilityTrailLayer.visible = false;
  stage.utilityOverlayLayer.removeChildren().forEach((child) => child.destroy());
  if (needsFullRender) {
    stage.playerLayer.removeChildren().forEach((child) => child.destroy());
    stage.bombLayer.removeChildren().forEach((child) => child.destroy());
    stage.killLayer.removeChildren().forEach((child) => child.destroy());
    stage.trailLayer.removeChildren().forEach((child) => child.destroy());
    stage.eventLayer.removeChildren().forEach((child) => child.destroy());
  }

  for (const utility of round.utilityEntities) {
    if (!utilityMatchesFocus(utility.kind, utilityFocus)) {
      continue;
    }

    drawUtilityVisual(
      stage.utilityTrailLayer,
      stage.utilityOverlayLayer,
      replay,
      utility,
      resolveUtilityThrowerSide(round, utility.throwerPlayerId),
      playerById.get(utility.throwerPlayerId ?? "")?.displayName ?? null,
      currentTick,
      radarViewport,
      tickRate,
    );
  }

  if (!needsFullRender) {
    return;
  }

  stage.lastFullRenderTick = fullRenderTick;
  stage.lastRoundNumber = round.roundNumber;
  stage.lastSelectedPlayerId = selectedPlayerId;
  const livePlayers: Array<{
    hasBomb: boolean;
    player: Replay["players"][number] | undefined;
    playerId: string;
    point: { x: number; y: number };
    yaw: number | null;
    selected: boolean;
    side: "T" | "CT" | null;
    stream: Round["playerStreams"][number];
  }> = [];

  for (const bombEvent of round.bombEvents) {
    drawBombEvent(stage.bombLayer, replay, bombEvent, fullRenderTick, radarViewport);
  }

  for (const hurtEvent of round.hurtEvents) {
    drawHurtEvent(stage.killLayer, replay, round, hurtEvent, fullRenderTick, radarViewport);
  }

  for (const killEvent of round.killEvents) {
    drawKillEvent(stage.killLayer, replay, killEvent, fullRenderTick, radarViewport);
  }

  for (const stream of round.playerStreams) {
    const sample = interpolatePlayerSample(stream, fullRenderTick);
    if (!sample) {
      continue;
    }

    const { alive, hasBomb, x, y } = sample;
    if (!alive || x == null || y == null) {
      continue;
    }

    const player = playerById.get(stream.playerId);
    const point = worldToScreen(replay, radarViewport, x, y);
    const selected = selectedPlayerId === stream.playerId;

    const marker = new Graphics();
    marker.eventMode = "static";
    marker.cursor = "pointer";
    marker.on("pointertap", () => onSelectPlayer(stream.playerId));

    drawPlayerMarker(marker, point.x, point.y, stream.side, selected, sample.yaw);

    if (hasBomb) {
      marker.roundRect(point.x + 9, point.y - 13, 9, 9, 2);
      marker.fill({ color: 0x15100a, alpha: 0.94 });
      marker.stroke({ color: 0xffd06c, width: 1.4, alpha: 0.9 });
      marker.rect(point.x + 11.5, point.y - 10.5, 4, 4);
      marker.stroke({ color: 0xffd06c, width: 1.2, alpha: 0.92 });
    }

    stage.playerLayer.addChild(marker);
    livePlayers.push({
      hasBomb,
      player,
      playerId: stream.playerId,
      point,
      yaw: sample.yaw,
      selected,
      side: stream.side,
      stream,
    });
  }

  drawPlayerLabels(
    stage.eventLayer,
    livePlayers.filter((entry): entry is typeof entry & { player: Replay["players"][number] } => entry.player != null),
  );
}

function interpolatePlayerSample(
  stream: Round["playerStreams"][number],
  currentTick: number,
) {
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
) {
  const fillColor = side === "CT" ? 0x3fa8ff : 0xf3a448;
  const strokeColor = selected ? 0xf6fbff : 0x091116;
  const radius = selected ? 9 : 7;
  const ringColor = selected ? 0xf6fbff : 0xe9f0f5;
  marker.circle(x, y, radius);
  marker.fill({ color: fillColor, alpha: selected ? 1 : 0.96 });
  marker.stroke({ color: strokeColor, width: selected ? 2.4 : 2 });
  marker.circle(x, y, selected ? 2.2 : 1.7);
  marker.fill({ color: 0xf7fbff, alpha: 0.2 });
  marker.circle(x, y, radius + (selected ? 1.2 : 0.8));
  marker.stroke({ color: ringColor, width: selected ? 1.1 : 0.8, alpha: 0.18 });

  if (yaw != null) {
    const radians = (yaw * Math.PI) / 180;
    const pointerBaseDistance = radius - 0.8;
    const pointerTipDistance = radius + (selected ? 5.6 : 4.8);
    const pointerHalfWidth = selected ? 3.2 : 2.8;
    const baseX = x + Math.cos(radians) * pointerBaseDistance;
    const baseY = y - Math.sin(radians) * pointerBaseDistance;
    const tipX = x + Math.cos(radians) * pointerTipDistance;
    const tipY = y - Math.sin(radians) * pointerTipDistance;
    const normalX = Math.cos(radians + Math.PI / 2) * pointerHalfWidth;
    const normalY = -Math.sin(radians + Math.PI / 2) * pointerHalfWidth;

    marker.moveTo(baseX + normalX, baseY + normalY);
    marker.lineTo(baseX - normalX, baseY - normalY);
    marker.lineTo(tipX, tipY);
    marker.closePath();
    marker.fill({ color: fillColor, alpha: 0.98 });
    marker.stroke({ color: strokeColor, width: selected ? 1.4 : 1.1, alpha: 0.92 });

    marker.circle(tipX, tipY, selected ? 1.8 : 1.5);
    marker.fill({ color: 0xf6fbff, alpha: 0.9 });
  }
}

function compactPlayerLabel(name: string, maxLength: number) {
  if (name.length <= maxLength) {
    return name;
  }

  return `${name.slice(0, Math.max(3, maxLength - 1))}...`;
}

function applyCameraTransform(stage: StageState) {
  const centerX = stage.currentViewportWidth != null ? stage.currentViewportWidth / 2 : DEFAULT_STAGE_WIDTH / 2;
  const centerY = stage.currentViewportHeight != null ? stage.currentViewportHeight / 2 : DEFAULT_STAGE_HEIGHT / 2;
  stage.sceneRoot.pivot.set(centerX, centerY);
  stage.sceneRoot.position.set(centerX + stage.cameraOffsetX, centerY + stage.cameraOffsetY);
  stage.sceneRoot.scale.set(stage.cameraScale);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function radarImageURL(radarImageKey: string) {
  const normalizedKey = radarImageKey.replace(/^\/+/, "");
  return normalizedKey.startsWith("maps/") ? `/${normalizedKey}` : `/maps/${normalizedKey}`;
}

function drawBombEvent(
  layer: Container,
  replay: Replay,
  event: Round["bombEvents"][number],
  currentTick: number,
  radarViewport: RadarViewport,
) {
  if (!["plant_start", "planted", "defuse_start", "defused", "exploded"].includes(event.type)) {
    return;
  }

  if (event.tick > currentTick || currentTick - event.tick > RECENT_BOMB_WINDOW_TICKS) {
    return;
  }

  if (event.x == null || event.y == null) {
    return;
  }

  const point = worldToScreen(replay, radarViewport, event.x, event.y);
  const marker = new Graphics();
  marker.roundRect(point.x - 11, point.y - 8, 22, 16, 4);
  marker.fill({ color: 0x0b1217, alpha: 0.88 });
  marker.stroke({ color: 0xffb14f, width: 1.8, alpha: 0.82 });
  marker.rect(point.x - 5, point.y - 4, 10, 8);
  marker.stroke({ color: 0xffd08c, width: 1.4, alpha: 0.76 });
  marker.moveTo(point.x - 2, point.y - 10);
  marker.lineTo(point.x - 2, point.y - 15);
  marker.lineTo(point.x + 5, point.y - 15);
  marker.stroke({ color: 0xffb14f, width: 1.6, alpha: 0.8 });
  layer.addChild(marker);
}

function drawKillEvent(
  layer: Container,
  replay: Replay,
  event: Round["killEvents"][number],
  currentTick: number,
  radarViewport: RadarViewport,
) {
  if (event.tick > currentTick || currentTick - event.tick > RECENT_KILL_WINDOW_TICKS) {
    return;
  }

  if (event.victimX == null || event.victimY == null) {
    return;
  }

  const ageRatio = 1 - (currentTick - event.tick) / RECENT_KILL_WINDOW_TICKS;
  const point = worldToScreen(replay, radarViewport, event.victimX, event.victimY);
  const marker = new Graphics();
  marker.moveTo(point.x - 8, point.y - 8);
  marker.lineTo(point.x + 8, point.y + 8);
  marker.moveTo(point.x + 8, point.y - 8);
  marker.lineTo(point.x - 8, point.y + 8);
  marker.stroke({ color: 0xff7b72, width: 3, alpha: 0.32 + ageRatio * 0.6 });
  layer.addChild(marker);
}

function drawHurtEvent(
  layer: Container,
  replay: Replay,
  round: Round,
  event: Round["hurtEvents"][number],
  currentTick: number,
  radarViewport: RadarViewport,
) {
  if (event.tick > currentTick || currentTick - event.tick > RECENT_HURT_WINDOW_TICKS) {
    return;
  }

  if (event.attackerX == null || event.attackerY == null || event.victimX == null || event.victimY == null) {
    return;
  }

  const ageRatio = 1 - (currentTick - event.tick) / RECENT_HURT_WINDOW_TICKS;
  const attackerPoint = worldToScreen(replay, radarViewport, event.attackerX, event.attackerY);
  const victimPoint = worldToScreen(replay, radarViewport, event.victimX, event.victimY);
  const side = resolvePlayerSide(round, event.attackerPlayerId);
  const accentColor = side === "CT" ? 0x8ed1ff : side === "T" ? 0xffca78 : 0xffe2ad;
  const damageValue = event.healthDamageTaken > 0 ? event.healthDamageTaken : event.armorDamageTaken;

  const marker = new Graphics();
  marker.moveTo(attackerPoint.x, attackerPoint.y);
  marker.lineTo(victimPoint.x, victimPoint.y);
  marker.stroke({ color: accentColor, width: 2.6, alpha: 0.16 + ageRatio * 0.22 });
  marker.moveTo(attackerPoint.x, attackerPoint.y);
  marker.lineTo(victimPoint.x, victimPoint.y);
  marker.stroke({ color: 0xfff1cf, width: 1.2, alpha: 0.34 + ageRatio * 0.38 });
  marker.circle(victimPoint.x, victimPoint.y, 3 + ageRatio * 1.6);
  marker.fill({ color: accentColor, alpha: 0.08 + ageRatio * 0.14 });
  layer.addChild(marker);

  if (damageValue > 0) {
    const damageText = new Text({
      text: `${damageValue}`,
      style: {
        fill: 0xf3f5f8,
        fontFamily: "IBM Plex Sans, Segoe UI, sans-serif",
        fontSize: 10,
        fontWeight: "700",
        stroke: { color: 0x0a1218, width: 3, join: "round" },
      },
    });
    damageText.anchor.set(0.5, 1);
    damageText.roundPixels = true;
    damageText.resolution = 2;
    damageText.position.set(victimPoint.x, victimPoint.y - 8 - ageRatio * 8);
    damageText.alpha = 0.36 + ageRatio * 0.52;
    layer.addChild(damageText);
  }
}

function resolveUtilityThrowerSide(round: Round, throwerPlayerId: string | null) {
  if (!throwerPlayerId) {
    return null;
  }

  return round.playerStreams.find((stream) => stream.playerId === throwerPlayerId)?.side ?? null;
}

function resolvePlayerSide(round: Round, playerId: string | null) {
  if (!playerId) {
    return null;
  }

  return round.playerStreams.find((stream) => stream.playerId === playerId)?.side ?? null;
}

function resolveViewportDimensions(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return {
      height: DEFAULT_STAGE_HEIGHT,
      width: DEFAULT_STAGE_WIDTH,
    };
  }

  return {
    height: Math.max(MIN_STAGE_HEIGHT, Math.floor(height)),
    width: Math.max(MIN_STAGE_WIDTH, Math.floor(width)),
  };
}

function drawPlayerLabels(
  layer: Container,
  livePlayers: Array<{
    hasBomb: boolean;
    player: Replay["players"][number];
    point: { x: number; y: number };
    selected: boolean;
    side: "T" | "CT" | null;
  }>,
) {
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
