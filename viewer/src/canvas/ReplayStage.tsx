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
const RECENT_HURT_WINDOW_TICKS = 40;
const RECENT_KILL_WINDOW_TICKS = 64 * 6;
const RECENT_BOMB_WINDOW_TICKS = 64 * 8;
const HURT_BURST_GAP_TICKS = 6;
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

  const bombState = resolveActiveBombState(replay, round, fullRenderTick);
  if (bombState) {
    drawBombStateOverlay(stage.bombLayer, replay, bombState, fullRenderTick, radarViewport);
  }
  for (const bombEvent of round.bombEvents) {
    drawBombEvent(stage.bombLayer, replay, bombEvent, fullRenderTick, radarViewport);
  }

  for (const hurtBurst of buildVisibleHurtBursts(round, fullRenderTick)) {
    drawHurtBurst(stage.killLayer, replay, round, hurtBurst, fullRenderTick, radarViewport);
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

type ActiveBombState = {
  defuseCompletionTick: number | null;
  defuseStartTick: number | null;
  explodeTick: number | null;
  plantedTick: number;
  x: number;
  y: number;
};

function drawBombStateOverlay(
  layer: Container,
  replay: Replay,
  state: ActiveBombState,
  currentTick: number,
  radarViewport: RadarViewport,
) {
  const point = worldToScreen(replay, radarViewport, state.x, state.y);
  const pulse = 0.5 + 0.5 * Math.sin((currentTick - state.plantedTick) / 10);
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
  const outerRadius = 18;
  const baseRadius = 14;
  marker.circle(point.x, point.y, outerRadius + pulse * 1.2);
  marker.fill({ color: 0x04070b, alpha: 0.16 + pulse * 0.05 });
  marker.circle(point.x, point.y, outerRadius);
  marker.stroke({ color: 0x111a22, width: 5, alpha: 0.96 });
  marker.circle(point.x, point.y, outerRadius - 1);
  marker.stroke({ color: 0x243342, width: 3, alpha: 0.88 });

  if (bombProgress != null) {
    drawArcStroke(marker, point.x, point.y, outerRadius - 1, -Math.PI / 2, -Math.PI / 2 + bombProgress * Math.PI * 2);
    marker.stroke({
      color: countdownColor,
      width: 3,
      alpha: 0.94,
      cap: "round",
    });
  }

  drawBombThresholdTick(marker, point.x, point.y, outerRadius - 1, bombTimeTotalSeconds, 10, bombTimeRemainingSeconds, 0xf0b55a);
  drawBombThresholdTick(marker, point.x, point.y, outerRadius - 1, bombTimeTotalSeconds, 5, bombTimeRemainingSeconds, 0xff7b72);

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
      const sweepStart = -Math.PI / 2 + pulse * 0.5;
      drawArcStroke(marker, point.x, point.y, outerRadius + 4, sweepStart, sweepStart + Math.PI * 0.75);
      marker.stroke({ color: 0x79c8ff, width: 3.2, alpha: 0.9, cap: "round" });
    }
  }

  marker.circle(point.x, point.y, baseRadius);
  marker.fill({ color: 0x0b1217, alpha: 0.96 });
  marker.circle(point.x, point.y, baseRadius);
  marker.stroke({ color: 0x263747, width: 1.4, alpha: 0.92 });
  marker.roundRect(point.x - 5.5, point.y - 7, 11, 14, 2.5);
  marker.fill({ color: 0x201a21, alpha: 0.98 });
  marker.stroke({ color: 0xff7f8d, width: 1.5, alpha: 0.95 });
  marker.rect(point.x - 3, point.y - 3.5, 6, 7);
  marker.stroke({ color: 0xff7f8d, width: 1.2, alpha: 0.94 });
  marker.moveTo(point.x - 2, point.y - 9.5);
  marker.lineTo(point.x - 2, point.y - 12.5);
  marker.lineTo(point.x + 3.5, point.y - 12.5);
  marker.stroke({ color: 0xff7f8d, width: 1.2, alpha: 0.9 });
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

function drawBombThresholdTick(
  marker: Graphics,
  centerX: number,
  centerY: number,
  radius: number,
  totalBombSeconds: number | null,
  thresholdSeconds: number,
  secondsRemaining: number | null,
  color: number,
) {
  if (totalBombSeconds == null || thresholdSeconds >= totalBombSeconds) {
    return;
  }

  const progressAtThreshold = clamp(thresholdSeconds / totalBombSeconds, 0, 1);
  const angle = -Math.PI / 2 + progressAtThreshold * Math.PI * 2;
  const innerRadius = radius - 3.5;
  const outerRadius = radius + 2.5;
  const startX = centerX + Math.cos(angle) * innerRadius;
  const startY = centerY + Math.sin(angle) * innerRadius;
  const endX = centerX + Math.cos(angle) * outerRadius;
  const endY = centerY + Math.sin(angle) * outerRadius;
  const active = secondsRemaining != null && secondsRemaining <= thresholdSeconds;
  marker.moveTo(startX, startY);
  marker.lineTo(endX, endY);
  marker.stroke({ color, width: active ? 2.1 : 1.4, alpha: active ? 0.96 : 0.5, cap: "round" });
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
  const glowAlpha = 0.04 + fade * 0.08;
  const lineAlpha = 0.12 + fade * 0.22;
  const coreAlpha = 0.18 + fade * 0.28;
  const labelSpread = 10 + Math.min(2, event.labelOffsetIndex) * 12;
  const labelRise = 3 + event.labelOffsetIndex * 9 + fade * 5;
  const labelX = endX + nx * 4 + px * labelNormalSign * labelSpread;
  const labelY = endY + py * labelNormalSign * labelSpread - labelRise;
  const impactRadius = 2.7 + burstStrength * 0.9 + fade * 0.9;

  const marker = new Graphics();
  marker.moveTo(startX, startY);
  marker.lineTo(endX, endY);
  marker.stroke({ cap: "round", color: accentColor, join: "round", width: 2.5 * burstStrength, alpha: glowAlpha });
  marker.moveTo(startX, startY);
  marker.lineTo(endX, endY);
  marker.stroke({ cap: "round", color: accentColor, join: "round", width: 1.45, alpha: lineAlpha });
  marker.moveTo(startX, startY);
  marker.lineTo(endX, endY);
  marker.stroke({ cap: "round", color: 0xfff1cf, join: "round", width: 0.75, alpha: coreAlpha });
  marker.circle(startX, startY, 0.9 + fade * 0.45);
  marker.fill({ color: accentColor, alpha: 0.12 + fade * 0.1 });
  marker.circle(endX, endY, impactRadius);
  marker.stroke({ color: accentColor, width: 0.95, alpha: 0.12 + fade * 0.18 });
  marker.circle(endX, endY, 1.35 + fade * 0.45);
  marker.fill({ color: armorOnly ? 0xb8daff : 0xfff1cf, alpha: 0.18 + fade * 0.16 });
  layer.addChild(marker);

  if (damageValue > 0 && event.showDamageLabel) {
    const damageText = new Text({
      text: armorOnly ? `${damageValue}A` : `${damageValue}`,
      style: {
        fill: armorOnly ? 0xb8daff : 0xf3f5f8,
        fontFamily: "IBM Plex Sans, Segoe UI, sans-serif",
        fontSize: event.count > 1 ? 12 : 11,
        fontWeight: "700",
        stroke: { color: 0x0a1218, width: 3, join: "round" },
      },
    });
    damageText.anchor.set(0.5, 1);
    damageText.roundPixels = true;
    damageText.resolution = 2;
    damageText.position.set(labelX, labelY);
    damageText.alpha = 0.42 + fade * 0.38;
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
    if (
      previous &&
      event.tick - previous.lastTick <= HURT_BURST_GAP_TICKS
    ) {
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
