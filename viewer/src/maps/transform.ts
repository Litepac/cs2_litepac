import type { Replay } from "../replay/types";

export type ScreenPoint = { x: number; y: number };

export type RadarViewport = {
  cropHeight: number;
  cropLeft: number;
  cropTop: number;
  cropWidth: number;
  imageHeight: number;
  imageWidth: number;
  offsetX: number;
  offsetY: number;
  scale: number;
  viewportHeight: number;
  viewportWidth: number;
};

type RadarImageMeta = {
  cropHeight: number;
  cropLeft: number;
  cropTop: number;
  cropWidth: number;
  imageHeight: number;
  imageWidth: number;
};

const radarSizeCache = new Map<string, Promise<RadarImageMeta>>();

export function createRadarViewport(
  replay: Replay,
  viewportWidth: number,
  viewportHeight: number,
  imageWidth: number,
  imageHeight: number,
  cropLeft = 0,
  cropTop = 0,
  cropWidth = imageWidth,
  cropHeight = imageHeight,
): RadarViewport {
  const safeImageWidth = Math.max(1, imageWidth);
  const safeImageHeight = Math.max(1, imageHeight);
  const safeCropLeft = clamp(cropLeft, 0, safeImageWidth - 1);
  const safeCropTop = clamp(cropTop, 0, safeImageHeight - 1);
  const safeCropWidth = clamp(cropWidth, 1, safeImageWidth - safeCropLeft);
  const safeCropHeight = clamp(cropHeight, 1, safeImageHeight - safeCropTop);
  // The replay shell gives the roster its own column, but the map still needs
  // a stable fit with a little breathing room for the top HUD and analysis
  // panel. Favor a complete fit over edge clipping.
  const leftPadding = clamp(Math.round(viewportWidth * 0.006), 3, 10);
  const rightPadding = clamp(Math.round(viewportWidth * 0.008), 6, 18);
  const topPadding = clamp(Math.round(viewportHeight * 0.026), 14, 30);
  const bottomPadding = clamp(Math.round(viewportHeight * 0.01), 5, 14);
  const fitWidth = Math.max(1, viewportWidth - leftPadding - rightPadding);
  const fitHeight = Math.max(1, viewportHeight - topPadding - bottomPadding);
  const fitScale = Math.min(fitWidth / safeCropWidth, fitHeight / safeCropHeight);
  const scale = fitScale * 0.998;
  const scaledWidth = safeCropWidth * scale;
  const scaledHeight = safeCropHeight * scale;

  return {
    cropHeight: safeCropHeight,
    cropLeft: safeCropLeft,
    cropTop: safeCropTop,
    cropWidth: safeCropWidth,
    imageHeight: safeImageHeight,
    imageWidth: safeImageWidth,
    offsetX: leftPadding + (fitWidth - scaledWidth) / 2 - safeCropLeft * scale,
    offsetY: topPadding + (fitHeight - scaledHeight) / 2 - safeCropTop * scale,
    scale,
    viewportHeight,
    viewportWidth,
  };
}

export async function loadRadarImageSize(url: string): Promise<RadarImageMeta> {
  const cached = radarSizeCache.get(url);
  if (cached) {
    return cached;
  }

  const pending = readRadarImageSize(url);
  radarSizeCache.set(url, pending);
  return pending;
}

export function worldToScreen(replay: Replay, viewport: RadarViewport, worldX: number, worldY: number): ScreenPoint {
  const { worldXMin, worldXMax, worldYMin, worldYMax } = replay.map.coordinateSystem;
  const xRatio = (worldX - worldXMin) / (worldXMax - worldXMin);
  const yRatio = 1 - (worldY - worldYMin) / (worldYMax - worldYMin);

  const imageX = xRatio * viewport.imageWidth;
  const imageY = yRatio * viewport.imageHeight;

  return {
    x: imageX * viewport.scale + viewport.offsetX,
    y: imageY * viewport.scale + viewport.offsetY,
  };
}

async function readRadarImageSize(url: string) {
  const image = new Image();
  image.decoding = "async";
  image.src = url;
  await image.decode();

  const imageHeight = image.naturalHeight || image.height || 1;
  const imageWidth = image.naturalWidth || image.width || 1;
  const bounds = detectVisibleBounds(image, imageWidth, imageHeight);

  return {
    cropHeight: bounds.height,
    cropLeft: bounds.left,
    cropTop: bounds.top,
    cropWidth: bounds.width,
    imageHeight,
    imageWidth,
  };
}

function detectVisibleBounds(image: HTMLImageElement, imageWidth: number, imageHeight: number) {
  const canvas = document.createElement("canvas");
  canvas.width = imageWidth;
  canvas.height = imageHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return { height: imageHeight, left: 0, top: 0, width: imageWidth };
  }

  context.drawImage(image, 0, 0, imageWidth, imageHeight);
  const { data } = context.getImageData(0, 0, imageWidth, imageHeight);
  const background = sampleBackgroundColor(data, imageWidth, imageHeight);
  let left = imageWidth;
  let right = -1;
  let top = imageHeight;
  let bottom = -1;

  for (let y = 0; y < imageHeight; y += 1) {
    for (let x = 0; x < imageWidth; x += 1) {
      const offset = (y * imageWidth + x) * 4;
      const alpha = data[offset + 3];
      if (alpha <= 8) {
        continue;
      }
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      if (isBackgroundPixel(red, green, blue, alpha, background)) {
        continue;
      }
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }

  if (right < left || bottom < top) {
    return { height: imageHeight, left: 0, top: 0, width: imageWidth };
  }

  const padding = 0;
  const paddedLeft = clamp(left - padding, 0, imageWidth - 1);
  const paddedTop = clamp(top - padding, 0, imageHeight - 1);
  const paddedRight = clamp(right + padding, paddedLeft + 1, imageWidth);
  const paddedBottom = clamp(bottom + padding, paddedTop + 1, imageHeight);

  const trimmedBounds = trimBackgroundMargins(
    data,
    imageWidth,
    imageHeight,
    paddedLeft,
    paddedTop,
    paddedRight,
    paddedBottom,
    background,
  );

  return {
    height: trimmedBounds.bottom - trimmedBounds.top,
    left: trimmedBounds.left,
    top: trimmedBounds.top,
    width: trimmedBounds.right - trimmedBounds.left,
  };
}

function sampleBackgroundColor(data: Uint8ClampedArray, imageWidth: number, imageHeight: number) {
  const left = 0;
  const right = Math.max(0, imageWidth - 1);
  const top = 0;
  const bottom = Math.max(0, imageHeight - 1);
  const middleX = Math.floor(imageWidth / 2);
  const middleY = Math.floor(imageHeight / 2);
  const sampleOffsets = [
    (top * imageWidth + left) * 4,
    (top * imageWidth + middleX) * 4,
    (top * imageWidth + right) * 4,
    (middleY * imageWidth + left) * 4,
    (middleY * imageWidth + right) * 4,
    (bottom * imageWidth + left) * 4,
    (bottom * imageWidth + middleX) * 4,
    (bottom * imageWidth + right) * 4,
  ];
  let count = 0;
  let red = 0;
  let green = 0;
  let blue = 0;
  let alpha = 0;

  for (const offset of sampleOffsets) {
    red += data[offset];
    green += data[offset + 1];
    blue += data[offset + 2];
    alpha += data[offset + 3];
    count += 1;
  }

  return {
    alpha: alpha / count,
    blue: blue / count,
    green: green / count,
    red: red / count,
  };
}

function isBackgroundPixel(
  red: number,
  green: number,
  blue: number,
  alpha: number,
  background: { alpha: number; blue: number; green: number; red: number },
) {
  const alphaDelta = Math.abs(alpha - background.alpha);
  const colorDelta =
    Math.abs(red - background.red) +
    Math.abs(green - background.green) +
    Math.abs(blue - background.blue);

  return alphaDelta <= 8 && colorDelta <= 18;
}

function trimBackgroundMargins(
  data: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  initialLeft: number,
  initialTop: number,
  initialRight: number,
  initialBottom: number,
  background: { alpha: number; blue: number; green: number; red: number },
) {
  let left = initialLeft;
  let top = initialTop;
  let right = initialRight;
  let bottom = initialBottom;

  while (right - left > 32 && columnBackgroundRatio(data, imageWidth, imageHeight, left, top, bottom, background) >= 0.985) {
    left += 1;
  }

  while (right - left > 32 && columnBackgroundRatio(data, imageWidth, imageHeight, right - 1, top, bottom, background) >= 0.985) {
    right -= 1;
  }

  while (bottom - top > 32 && rowBackgroundRatio(data, imageWidth, imageHeight, top, left, right, background) >= 0.985) {
    top += 1;
  }

  while (bottom - top > 32 && rowBackgroundRatio(data, imageWidth, imageHeight, bottom - 1, left, right, background) >= 0.985) {
    bottom -= 1;
  }

  return { bottom, left, right, top };
}

function columnBackgroundRatio(
  data: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  x: number,
  top: number,
  bottom: number,
  background: { alpha: number; blue: number; green: number; red: number },
) {
  let backgroundCount = 0;
  let total = 0;

  for (let y = top; y < bottom && y < imageHeight; y += 1) {
    const offset = (y * imageWidth + x) * 4;
    const alpha = data[offset + 3];
    if (alpha <= 8) {
      backgroundCount += 1;
      total += 1;
      continue;
    }
    if (isBackgroundPixel(data[offset], data[offset + 1], data[offset + 2], alpha, background)) {
      backgroundCount += 1;
    }
    total += 1;
  }

  return total === 0 ? 1 : backgroundCount / total;
}

function rowBackgroundRatio(
  data: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  y: number,
  left: number,
  right: number,
  background: { alpha: number; blue: number; green: number; red: number },
) {
  let backgroundCount = 0;
  let total = 0;

  for (let x = left; x < right && x < imageWidth; x += 1) {
    const offset = (y * imageWidth + x) * 4;
    const alpha = data[offset + 3];
    if (alpha <= 8) {
      backgroundCount += 1;
      total += 1;
      continue;
    }
    if (isBackgroundPixel(data[offset], data[offset + 1], data[offset + 2], alpha, background)) {
      backgroundCount += 1;
    }
    total += 1;
  }

  return total === 0 ? 1 : backgroundCount / total;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
