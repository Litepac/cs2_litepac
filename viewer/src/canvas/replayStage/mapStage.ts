import { Application, Assets, Container, Rectangle, Sprite, Texture } from "pixi.js";

import { createRadarViewport, loadRadarImageSize } from "../../maps/transform";
import type { Replay } from "../../replay/types";
import { DEFAULT_STAGE_HEIGHT, DEFAULT_STAGE_WIDTH } from "./constants";
import { applyCameraTransform } from "./camera";
import type { StageState } from "./types";

export function resolveStageRenderResolution() {
  if (typeof window === "undefined") {
    return 1;
  }

  const ratio = Number.isFinite(window.devicePixelRatio) ? window.devicePixelRatio : 1;
  return Math.min(2.5, Math.max(1, ratio || 1));
}

export async function createStageState(hostElement: HTMLDivElement) {
  const app = new Application();
  const renderResolution = resolveStageRenderResolution();
  await app.init({
    width: DEFAULT_STAGE_WIDTH,
    height: DEFAULT_STAGE_HEIGHT,
    antialias: true,
    autoDensity: true,
    backgroundAlpha: 0,
    resolution: renderResolution,
  });

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
    killLayer,
    trailLayer,
    eventLayer,
    playerLayer,
    utilityOverlayLayer,
    bombLayer,
  );
  app.stage.addChild(sceneRoot);
  hostElement.appendChild(app.canvas);

  return {
    app,
    sceneRoot,
    mapLayer,
    utilityOverlayLayer,
    utilityTrailLayer,
    bombLayer,
    killLayer,
    mapClipMask: null,
    trailLayer,
    playerLayer,
    eventLayer,
    currentMapKey: null,
    currentViewportHeight: null,
    currentViewportWidth: null,
    lastAtlasEntryKey: null,
    lastFullRenderTick: null,
    lastRoundNumber: null,
    lastSelectedPlayerId: null,
    currentRenderResolution: renderResolution,
    radarViewport: null,
    cameraOffsetX: 0,
    cameraOffsetY: 0,
    cameraScale: 1,
  } satisfies StageState;
}

export async function ensureStageMap(
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

  const maskTexture = await createRadarAlphaMaskTexture(radarURL, radarViewport);
  const mapClipMask = new Sprite(maskTexture ?? croppedTexture);
  mapClipMask.x = sprite.x;
  mapClipMask.y = sprite.y;
  mapClipMask.width = sprite.width;
  mapClipMask.height = sprite.height;
  mapClipMask.renderable = false;
  stage.mapLayer.addChild(mapClipMask);

  stage.currentMapKey = replay.map.radarImageKey;
  stage.currentViewportWidth = viewportWidth;
  stage.currentViewportHeight = viewportHeight;
  stage.lastAtlasEntryKey = null;
  stage.lastFullRenderTick = null;
  stage.lastRoundNumber = null;
  stage.lastSelectedPlayerId = null;
  stage.mapClipMask = mapClipMask;
  stage.radarViewport = radarViewport;
  applyCameraTransform(stage);
}

function radarImageURL(radarImageKey: string) {
  const normalizedKey = radarImageKey.replace(/^\/+/, "");
  return normalizedKey.startsWith("maps/") ? `/${normalizedKey}` : `/maps/${normalizedKey}`;
}

async function createRadarAlphaMaskTexture(
  radarURL: string,
  radarViewport: {
    cropLeft: number;
    cropTop: number;
    cropWidth: number;
    cropHeight: number;
  },
) {
  if (typeof document === "undefined" || typeof Image === "undefined") {
    return null;
  }

  const image = new Image();
  image.decoding = "async";
  image.src = radarURL;

  try {
    await image.decode();
  } catch {
    return null;
  }

  const width = Math.max(1, Math.round(radarViewport.cropWidth));
  const height = Math.max(1, Math.round(radarViewport.cropHeight));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return null;
  }

  context.drawImage(
    image,
    radarViewport.cropLeft,
    radarViewport.cropTop,
    radarViewport.cropWidth,
    radarViewport.cropHeight,
    0,
    0,
    width,
    height,
  );

  const imageData = context.getImageData(0, 0, width, height);
  const data = imageData.data;
  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3];
    data[index] = 255;
    data[index + 1] = 255;
    data[index + 2] = 255;
    data[index + 3] = alpha > 8 ? 255 : 0;
  }
  context.putImageData(imageData, 0, 0);

  return Texture.from(canvas);
}
