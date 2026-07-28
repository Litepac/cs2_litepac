export const FIRE_FIELD_RADIUS = 13.5;
const FIRE_FIELD_PADDING = 3;
const FIRE_RASTER_MAX_DIMENSION = 320;
const FIRE_RASTER_MAX_PIXELS = 80_000;

export type FireRasterPoint = {
  x: number;
  y: number;
};

export type FireRasterGeometry = {
  height: number;
  key: string;
  originX: number;
  originY: number;
  points: FireRasterPoint[];
  width: number;
};

export function resolveFireRasterGeometry(points: FireRasterPoint[]): FireRasterGeometry | null {
  const normalized = points
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    .map((point) => ({ x: quantize(point.x), y: quantize(point.y) }))
    .sort((left, right) => left.x - right.x || left.y - right.y)
    .filter((point, index, values) => index === 0 || point.x !== values[index - 1].x || point.y !== values[index - 1].y);
  if (normalized.length === 0) {
    return null;
  }

  const padding = FIRE_FIELD_RADIUS + FIRE_FIELD_PADDING;
  const originX = Math.floor(Math.min(...normalized.map((point) => point.x)) - padding);
  const originY = Math.floor(Math.min(...normalized.map((point) => point.y)) - padding);
  const right = Math.ceil(Math.max(...normalized.map((point) => point.x)) + padding);
  const bottom = Math.ceil(Math.max(...normalized.map((point) => point.y)) + padding);
  const localPoints = normalized.map((point) => ({ x: point.x - originX, y: point.y - originY }));
  const width = Math.max(1, right - originX);
  const height = Math.max(1, bottom - originY);
  if (width > FIRE_RASTER_MAX_DIMENSION || height > FIRE_RASTER_MAX_DIMENSION || width * height > FIRE_RASTER_MAX_PIXELS) {
    return null;
  }
  const key = `${width}x${height}:${localPoints.map((point) => `${point.x},${point.y}`).join(";")}`;

  return { height, key, originX, originY, points: localPoints, width };
}

export function createFireRasterPixels(geometry: FireRasterGeometry) {
  const pixels = new Uint8ClampedArray(geometry.width * geometry.height * 4);
  const seed = hashString(geometry.key);

  for (let y = 0; y < geometry.height; y += 1) {
    for (let x = 0; x < geometry.width; x += 1) {
      const distance = nearestDistance(x + 0.5, y + 0.5, geometry.points);
      const body = 1 - smoothstep(FIRE_FIELD_RADIUS - 4.6, FIRE_FIELD_RADIUS, distance);
      const edgeGlow = 1 - smoothstep(FIRE_FIELD_RADIUS, FIRE_FIELD_RADIUS + 2.4, distance);
      if (edgeGlow <= 0.002) {
        continue;
      }

      // Noise breaks up the field without assigning a bright disc to every
      // parser cell. The exact samples still own the union and its outline.
      const broadNoise = fbm(x * 0.075, y * 0.075, seed, 3);
      const fineNoise = valueNoise(x * 0.21, y * 0.21, seed ^ 0xa511e9b3);
      const texture = (broadNoise - 0.5) * 0.28 + (fineNoise - 0.5) * 0.12;
      const warmth = clamp01(0.57 + texture);
      const alpha = clampByte((body * (0.68 + broadNoise * 0.2) + (edgeGlow - body) * 0.2) * 255);
      const offset = (y * geometry.width + x) * 4;

      pixels[offset] = clampByte(mix(232, 255, warmth));
      pixels[offset + 1] = clampByte(mix(78, 178, warmth));
      pixels[offset + 2] = clampByte(mix(18, 72, warmth));
      pixels[offset + 3] = alpha;
    }
  }

  return pixels;
}

function nearestDistance(x: number, y: number, points: FireRasterPoint[]) {
  let nearestSquared = Number.POSITIVE_INFINITY;
  for (const point of points) {
    const dx = x - point.x;
    const dy = y - point.y;
    nearestSquared = Math.min(nearestSquared, dx * dx + dy * dy);
  }
  return Math.sqrt(nearestSquared);
}

function fbm(x: number, y: number, seed: number, octaves: number) {
  let amplitude = 0.58;
  let frequency = 1;
  let sum = 0;
  let weight = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    sum += valueNoise(x * frequency, y * frequency, seed + octave * 1013) * amplitude;
    weight += amplitude;
    amplitude *= 0.5;
    frequency *= 2.07;
  }
  return weight > 0 ? sum / weight : 0;
}

function valueNoise(x: number, y: number, seed: number) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smoothCurve(x - x0);
  const ty = smoothCurve(y - y0);
  const top = mix(gridNoise(x0, y0, seed), gridNoise(x0 + 1, y0, seed), tx);
  const bottom = mix(gridNoise(x0, y0 + 1, seed), gridNoise(x0 + 1, y0 + 1, seed), tx);
  return mix(top, bottom, ty);
}

function gridNoise(x: number, y: number, seed: number) {
  let value = seed ^ Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1);
  value = Math.imul(value ^ (value >>> 15), 0x85ebca6b);
  value ^= value >>> 13;
  return (value >>> 0) / 4294967295;
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function quantize(value: number) {
  return Math.round(value * 2) / 2;
}

function smoothCurve(value: number) {
  return value * value * (3 - 2 * value);
}

function smoothstep(edge0: number, edge1: number, value: number) {
  return smoothCurve(clamp01((value - edge0) / Math.max(0.0001, edge1 - edge0)));
}

function mix(left: number, right: number, amount: number) {
  return left + (right - left) * amount;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function clampByte(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}
