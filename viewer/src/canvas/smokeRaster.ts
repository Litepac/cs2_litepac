export const SMOKE_RASTER_SIZE = 128;
export const SMOKE_RASTER_VARIANTS = 12;

export type SmokeRasterCutout = {
  radiusX: number;
  radiusY: number;
  strength: number;
  x: number;
  y: number;
};

export function smokeRasterVariant(utilityId: string) {
  let hash = 2166136261;
  for (let index = 0; index < utilityId.length; index += 1) {
    hash ^= utilityId.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % SMOKE_RASTER_VARIANTS;
}

export function createSmokeRasterPixels(variant: number) {
  const normalizedVariant = Math.abs(Math.trunc(variant)) % SMOKE_RASTER_VARIANTS;
  const seed = (0x9e3779b9 ^ Math.imul(normalizedVariant + 1, 0x85ebca6b)) >>> 0;
  const phase = (normalizedVariant / SMOKE_RASTER_VARIANTS) * Math.PI * 2;
  const pixels = new Uint8ClampedArray(SMOKE_RASTER_SIZE * SMOKE_RASTER_SIZE * 4);

  for (let y = 0; y < SMOKE_RASTER_SIZE; y += 1) {
    const ny = ((y + 0.5) / SMOKE_RASTER_SIZE) * 2 - 1;
    for (let x = 0; x < SMOKE_RASTER_SIZE; x += 1) {
      const nx = ((x + 0.5) / SMOKE_RASTER_SIZE) * 2 - 1;
      const lowNoise = fbm(nx * 1.55 + phase, ny * 1.55 - phase * 0.4, seed, 3);
      const mediumNoise = fbm(nx * 3.8 - phase * 0.7, ny * 3.8 + phase, seed ^ 0xa511e9b3, 3);
      const fineNoise = valueNoise(nx * 10.5 + phase, ny * 10.5 - phase, seed ^ 0x63d83595);
      const warpedX = nx + (mediumNoise - 0.5) * 0.055;
      const warpedY = ny + (lowNoise - 0.5) * 0.07;
      // The current Valve point-cloud source is effectively circular in the
      // horizontal plane. Geometry still owns its in-game deformation; this
      // near-circular field is only the neutral replay presentation.
      const radius = Math.hypot(warpedX / 0.945, warpedY / 0.935);
      const angle = Math.atan2(warpedY, warpedX);
      const boundary =
        0.7 +
        (lowNoise - 0.5) * 0.2 +
        Math.sin(angle * 3 + phase) * 0.038 +
        Math.sin(angle * 5 - phase * 0.65) * 0.026;
      const signedDistance = boundary - radius;
      const edgeCoverage = smoothstep(-0.09, 0.085, signedDistance);

      if (edgeCoverage <= 0.002) {
        continue;
      }

      const density = Math.min(0.92, 0.75 + mediumNoise * 0.13 + fineNoise * 0.065);
      const innerMix = smoothstep(-0.015, 0.15, signedDistance);
      const swirl = Math.sin(angle * 2.4 + radius * 17 + mediumNoise * 4.2);
      const grey = clampByte(146 + innerMix * 37 + (mediumNoise - 0.5) * 22 + swirl * 4.5);
      const alpha = clampByte(edgeCoverage * density * 255);
      const offset = (y * SMOKE_RASTER_SIZE + x) * 4;
      pixels[offset] = grey;
      pixels[offset + 1] = clampByte(grey + 4);
      pixels[offset + 2] = clampByte(grey + 6);
      pixels[offset + 3] = alpha;
    }
  }

  return pixels;
}

export function applySmokeRasterCutout(basePixels: Uint8ClampedArray, cutout: SmokeRasterCutout) {
  const pixels = new Uint8ClampedArray(basePixels);
  const radiusX = Math.max(0.01, cutout.radiusX);
  const radiusY = Math.max(0.01, cutout.radiusY);
  const strength = Math.max(0, Math.min(1, cutout.strength));

  if (strength <= 0) {
    return pixels;
  }

  for (let y = 0; y < SMOKE_RASTER_SIZE; y += 1) {
    const ny = ((y + 0.5) / SMOKE_RASTER_SIZE) * 2 - 1;
    for (let x = 0; x < SMOKE_RASTER_SIZE; x += 1) {
      const offset = (y * SMOKE_RASTER_SIZE + x) * 4;
      if (pixels[offset + 3] === 0) {
        continue;
      }

      const nx = ((x + 0.5) / SMOKE_RASTER_SIZE) * 2 - 1;
      const distance = Math.hypot((nx - cutout.x) / radiusX, (ny - cutout.y) / radiusY);
      const pocket = (1 - smoothstep(0.46, 1.08, distance)) * strength;
      pixels[offset + 3] = clampByte(pixels[offset + 3] * (1 - pocket * 0.9));
    }
  }

  return pixels;
}

function fbm(x: number, y: number, seed: number, octaves: number) {
  let amplitude = 0.56;
  let frequency = 1;
  let sum = 0;
  let weight = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    sum += valueNoise(x * frequency, y * frequency, seed + octave * 1013) * amplitude;
    weight += amplitude;
    amplitude *= 0.5;
    frequency *= 2.03;
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

function smoothCurve(value: number) {
  return value * value * (3 - 2 * value);
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const normalized = Math.max(0, Math.min(1, (value - edge0) / Math.max(0.0001, edge1 - edge0)));
  return smoothCurve(normalized);
}

function mix(left: number, right: number, amount: number) {
  return left + (right - left) * amount;
}

function clampByte(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}
