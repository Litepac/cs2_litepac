import { Application, Assets, Container, Rectangle, Sprite, Texture } from "pixi.js";

import { createRadarViewport, loadRadarImageSize } from "../../maps/transform";
import type { Replay } from "../../replay/types";
import { DEFAULT_STAGE_HEIGHT, DEFAULT_STAGE_WIDTH } from "./constants";
import { applyCameraTransform } from "./camera";
import type { StageState } from "./types";

export async function createStageState(hostElement: HTMLDivElement) {
  const app = new Application();
  await app.init({
    width: DEFAULT_STAGE_WIDTH,
    height: DEFAULT_STAGE_HEIGHT,
    antialias: true,
    backgroundAlpha: 0,
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

function radarImageURL(radarImageKey: string) {
  const normalizedKey = radarImageKey.replace(/^\/+/, "");
  return normalizedKey.startsWith("maps/") ? `/${normalizedKey}` : `/maps/${normalizedKey}`;
}
