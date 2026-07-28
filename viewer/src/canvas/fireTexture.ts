import { Texture } from "pixi.js";

import {
  createFireRasterPixels,
  resolveFireRasterGeometry,
  type FireRasterPoint,
} from "./fireRaster";

const FIRE_TEXTURE_CACHE_LIMIT = 64;
const fireTextureCache = new Map<string, Texture>();

export type FireTextureVisual = {
  height: number;
  texture: Texture;
  width: number;
  x: number;
  y: number;
};

export function getFireTextureVisual(points: FireRasterPoint[]): FireTextureVisual | null {
  const geometry = resolveFireRasterGeometry(points);
  if (!geometry) {
    return null;
  }

  let texture = fireTextureCache.get(geometry.key);
  if (!texture) {
    texture = textureFromPixels(createFireRasterPixels(geometry), geometry.width, geometry.height);
    fireTextureCache.set(geometry.key, texture);
    trimTextureCache();
  }

  return {
    height: geometry.height,
    texture,
    width: geometry.width,
    x: geometry.originX,
    y: geometry.originY,
  };
}

function textureFromPixels(pixels: Uint8ClampedArray, width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Fire texture canvas is unavailable");
  }

  const image = context.createImageData(width, height);
  image.data.set(pixels);
  context.putImageData(image, 0, 0);
  const texture = Texture.from(canvas);
  texture.source.scaleMode = "linear";
  return texture;
}

function trimTextureCache() {
  while (fireTextureCache.size > FIRE_TEXTURE_CACHE_LIMIT) {
    const oldestKey = fireTextureCache.keys().next().value;
    if (!oldestKey) {
      return;
    }
    fireTextureCache.get(oldestKey)?.destroy(true);
    fireTextureCache.delete(oldestKey);
  }
}
