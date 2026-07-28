import { Texture } from "pixi.js";

import {
  applySmokeRasterCutout,
  createSmokeRasterPixels,
  SMOKE_RASTER_SIZE,
  smokeRasterVariant,
  type SmokeRasterCutout,
} from "./smokeRaster";

const SMOKE_CUTOUT_CACHE_LIMIT = 64;
const baseTextureCache = new Map<number, { pixels: Uint8ClampedArray; texture: Texture }>();
const cutoutTextureCache = new Map<string, Texture>();

export function getSmokeTexture(utilityId: string, cutout: SmokeRasterCutout | null) {
  const variant = smokeRasterVariant(utilityId);
  const base = getBaseTexture(variant);
  if (!cutout || cutout.strength < 0.035) {
    return base.texture;
  }

  const quantized = quantizeCutout(cutout);
  const key = [variant, quantized.x, quantized.y, quantized.radiusX, quantized.radiusY, quantized.strength].join(":");
  const cached = cutoutTextureCache.get(key);
  if (cached) {
    return cached;
  }

  const texture = textureFromPixels(applySmokeRasterCutout(base.pixels, quantized));
  cutoutTextureCache.set(key, texture);
  if (cutoutTextureCache.size > SMOKE_CUTOUT_CACHE_LIMIT) {
    const oldestKey = cutoutTextureCache.keys().next().value;
    if (oldestKey) {
      cutoutTextureCache.get(oldestKey)?.destroy(true);
      cutoutTextureCache.delete(oldestKey);
    }
  }
  return texture;
}

function getBaseTexture(variant: number) {
  const cached = baseTextureCache.get(variant);
  if (cached) {
    return cached;
  }

  const pixels = createSmokeRasterPixels(variant);
  const entry = { pixels, texture: textureFromPixels(pixels) };
  baseTextureCache.set(variant, entry);
  return entry;
}

function textureFromPixels(pixels: Uint8ClampedArray) {
  const canvas = document.createElement("canvas");
  canvas.width = SMOKE_RASTER_SIZE;
  canvas.height = SMOKE_RASTER_SIZE;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Smoke texture canvas is unavailable");
  }

  const image = context.createImageData(SMOKE_RASTER_SIZE, SMOKE_RASTER_SIZE);
  image.data.set(pixels);
  context.putImageData(image, 0, 0);
  const texture = Texture.from(canvas);
  texture.source.scaleMode = "linear";
  return texture;
}

function quantizeCutout(cutout: SmokeRasterCutout): SmokeRasterCutout {
  return {
    x: quantize(cutout.x, 0.08),
    y: quantize(cutout.y, 0.08),
    radiusX: Math.max(0.08, quantize(cutout.radiusX, 0.08)),
    radiusY: Math.max(0.08, quantize(cutout.radiusY, 0.08)),
    strength: Math.max(0, Math.min(1, quantize(cutout.strength, 0.1))),
  };
}

function quantize(value: number, step: number) {
  return Math.round(value / step) * step;
}
