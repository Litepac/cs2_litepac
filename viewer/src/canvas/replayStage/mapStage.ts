import { Application, Assets, Container, Rectangle, Sprite, Texture } from "pixi.js";

import { createRadarViewport, loadRadarImageSize } from "../../mapGeometry/transform";
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
  const deathReviewLayer = new Container();

  sceneRoot.addChild(
    mapLayer,
    utilityTrailLayer,
    killLayer,
    trailLayer,
    eventLayer,
    playerLayer,
    utilityOverlayLayer,
    deathReviewLayer,
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
    deathReviewLayer,
    bombLayer,
    killLayer,
    mapClipMask: null,
    trailLayer,
    playerLayer,
    eventLayer,
    currentMapKey: null,
    currentViewportHeight: null,
    currentViewportWidth: null,
    destroyed: false,
    lastAtlasEntryKey: null,
    lastFullRenderTick: null,
    lastRoundNumber: null,
    lastSelectedPlayerId: null,
    lastDeathReviewRenderKey: null,
    lastUtilityRenderKey: null,
    liveUtilityContainers: new Map(),
    mapLoadRequestId: 0,
    ownedMapTextures: {
      alphaMaskTexture: null,
      croppedTexture: null,
    },
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
  if (stage.destroyed) {
    return false;
  }

  if (
    stage.currentMapKey === replay.map.radarImageKey &&
    stage.currentViewportWidth === viewportWidth &&
    stage.currentViewportHeight === viewportHeight &&
    stage.radarViewport != null
  ) {
    return false;
  }

  const requestId = stage.mapLoadRequestId + 1;
  stage.mapLoadRequestId = requestId;
  const radarURL = radarImageURL(replay.map.radarImageKey);
  if (stage.currentMapKey != null && stage.currentMapKey !== replay.map.radarImageKey) {
    clearStageMap(stage);
  }

  const radarSize = await loadRadarImageSize(radarURL);
  if (isStaleMapRequest(stage, requestId)) {
    return false;
  }

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

  const texture = await Assets.load(radarURL);
  if (isStaleMapRequest(stage, requestId)) {
    return false;
  }

  const croppedTexture = new Texture({
    frame: new Rectangle(
      radarViewport.cropLeft,
      radarViewport.cropTop,
      radarViewport.cropWidth,
      radarViewport.cropHeight,
    ),
    source: texture.source,
  });

  let maskTexture: Texture | null = null;
  try {
    maskTexture = await createRadarAlphaMaskTexture(radarURL, radarViewport);
  } catch {
    maskTexture = null;
  }

  if (isStaleMapRequest(stage, requestId)) {
    destroyOwnedTexture(croppedTexture, false);
    if (maskTexture) {
      destroyOwnedTexture(maskTexture, true);
    }
    return false;
  }

  const sprite = new Sprite(croppedTexture);
  sprite.x = radarViewport.offsetX + radarViewport.cropLeft * radarViewport.scale;
  sprite.y = radarViewport.offsetY + radarViewport.cropTop * radarViewport.scale;
  sprite.width = radarViewport.cropWidth * radarViewport.scale;
  sprite.height = radarViewport.cropHeight * radarViewport.scale;

  const mapClipMask = new Sprite(maskTexture ?? croppedTexture);
  mapClipMask.x = sprite.x;
  mapClipMask.y = sprite.y;
  mapClipMask.width = sprite.width;
  mapClipMask.height = sprite.height;
  mapClipMask.renderable = false;

  clearStageMap(stage);
  stage.mapLayer.addChild(sprite);
  stage.mapLayer.addChild(mapClipMask);

  stage.currentMapKey = replay.map.radarImageKey;
  stage.currentViewportWidth = viewportWidth;
  stage.currentViewportHeight = viewportHeight;
  stage.lastAtlasEntryKey = null;
  stage.lastFullRenderTick = null;
  stage.lastRoundNumber = null;
  stage.lastSelectedPlayerId = null;
  stage.mapClipMask = mapClipMask;
  stage.ownedMapTextures = {
    alphaMaskTexture: maskTexture,
    croppedTexture,
  };
  stage.radarViewport = radarViewport;
  applyCameraTransform(stage);
  return true;
}

export function destroyStageState(stage: StageState) {
  stage.destroyed = true;
  stage.mapLoadRequestId += 1;
  clearStageMap(stage);
  stage.app.destroy(true, { children: true });
}

function isStaleMapRequest(stage: StageState, requestId: number) {
  return stage.destroyed || stage.mapLoadRequestId !== requestId;
}

function clearStageMap(stage: StageState) {
  detachMapClipMaskUsers(stage);
  stage.mapLayer.removeChildren().forEach((child) => child.destroy({ children: true }));
  destroyOwnedTexture(stage.ownedMapTextures.croppedTexture, false);
  destroyOwnedTexture(stage.ownedMapTextures.alphaMaskTexture, true);
  stage.ownedMapTextures = {
    alphaMaskTexture: null,
    croppedTexture: null,
  };
  stage.mapClipMask = null;
  stage.radarViewport = null;
}

export function detachMapClipMaskUsers(stage: StageState) {
  if (!stage.mapClipMask) {
    return;
  }

  detachMaskReferences(stage.sceneRoot, stage.mapClipMask);
}

function detachMaskReferences(container: Container, mask: Container) {
  for (const child of container.children) {
    if (child.mask === mask) {
      child.mask = null;
    }

    if (child instanceof Container) {
      detachMaskReferences(child, mask);
    }
  }
}

function destroyOwnedTexture(texture: Texture | null, destroySource: boolean) {
  if (!texture) {
    return;
  }

  texture.destroy(destroySource);
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
