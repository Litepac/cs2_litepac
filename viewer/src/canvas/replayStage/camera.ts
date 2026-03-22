import type { StageState } from "./types";
import {
  DEFAULT_STAGE_HEIGHT,
  DEFAULT_STAGE_WIDTH,
  MIN_STAGE_HEIGHT,
  MIN_STAGE_WIDTH,
} from "./constants";

export function applyCameraTransform(stage: StageState) {
  const centerX = stage.currentViewportWidth != null ? stage.currentViewportWidth / 2 : DEFAULT_STAGE_WIDTH / 2;
  const centerY = stage.currentViewportHeight != null ? stage.currentViewportHeight / 2 : DEFAULT_STAGE_HEIGHT / 2;
  stage.sceneRoot.pivot.set(centerX, centerY);
  stage.sceneRoot.position.set(centerX + stage.cameraOffsetX, centerY + stage.cameraOffsetY);
  stage.sceneRoot.scale.set(stage.cameraScale);
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function resolveViewportDimensions(width: number, height: number) {
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
