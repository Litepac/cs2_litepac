export type SmokeFieldLobe = {
  alpha: number;
  dx: number;
  dy: number;
  height: number;
  phase: number;
  width: number;
};

export type SmokeField = {
  body: SmokeFieldLobe[];
  texture: SmokeFieldLobe[];
  veil: SmokeFieldLobe[];
};

export type SmokeLifecyclePresentation = {
  opacity: number;
  scale: number;
};

export const SMOKE_FIELD_PALETTE = {
  ambient: 0x4b575c,
  body: 0xa6b0b3,
  texture: 0xc7ced0,
  textureShadow: 0x68767b,
  veil: 0xd0d6d8,
} as const;

export const SMOKE_LIFETIME_RING = {
  backdropWidth: 7.6,
  radius: 24,
  width: 5.6,
} as const;

const SMOKE_FIELD_CACHE_LIMIT = 256;
const smokeFieldCache = new Map<string, SmokeField>();

export function getSmokeField(utilityId: string) {
  const cached = smokeFieldCache.get(utilityId);
  if (cached) {
    return cached;
  }

  const field = createSmokeField(utilityId);
  smokeFieldCache.set(utilityId, field);
  if (smokeFieldCache.size > SMOKE_FIELD_CACHE_LIMIT) {
    const oldestKey = smokeFieldCache.keys().next().value;
    if (oldestKey) {
      smokeFieldCache.delete(oldestKey);
    }
  }
  return field;
}

export function resolveSmokeLifecyclePresentation(
  activeAgeSeconds: number | null,
  remainingSeconds: number | null,
): SmokeLifecyclePresentation {
  const age = activeAgeSeconds == null ? 1 : Math.max(0, activeAgeSeconds);
  const remaining = remainingSeconds == null ? 2 : Math.max(0, remainingSeconds);
  const bloom = Math.min(1, 0.2 + age / 0.55);
  const fade = Math.min(1, remaining / 1.1);

  return {
    opacity: Math.max(0, Math.min(bloom, fade)),
    scale: Math.min(1, 0.68 + age / 1.6),
  };
}

export function resolveSmokeLifetimeProgress(
  remainingSeconds: number | null,
  activeDurationSeconds: number | null,
) {
  if (remainingSeconds == null || activeDurationSeconds == null || activeDurationSeconds <= 0) {
    return null;
  }

  return Math.max(0, Math.min(1, remainingSeconds / activeDurationSeconds));
}

function createSmokeField(utilityId: string): SmokeField {
  // Demo truth stops at the detonation center and lifecycle. These bounded,
  // screen-space lobes communicate occlusion without claiming CS2's dynamic
  // collision-aware smoke boundary.
  const seed = smokeFieldSeed(utilityId);
  const body: SmokeFieldLobe[] = [
    { alpha: 0.34, dx: 0, dy: 0, width: 24, height: 26, phase: smokeNoise(seed, 11) * Math.PI * 2 },
  ];
  const veil: SmokeFieldLobe[] = [
    { alpha: 0.13, dx: 0, dy: -1, width: 20, height: 22, phase: smokeNoise(seed, 17) * Math.PI * 2 },
  ];
  const texture: SmokeFieldLobe[] = [];

  for (let index = 0; index < 8; index += 1) {
    const angle = (index / 8) * Math.PI * 2 + (smokeNoise(seed, 31 + index) - 0.5) * 0.42;
    const distance = 16 + smokeNoise(seed, 53 + index) * 5;
    body.push({
      alpha: 0.22 + smokeNoise(seed, 71 + index) * 0.06,
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance * 1.08,
      width: 16 + smokeNoise(seed, 97 + index) * 5,
      height: 17 + smokeNoise(seed, 113 + index) * 5,
      phase: smokeNoise(seed, 137 + index) * Math.PI * 2,
    });
  }

  for (let index = 0; index < 3; index += 1) {
    const angle = (index / 3) * Math.PI * 2 + smokeNoise(seed, 173 + index) * 1.1;
    const distance = 7 + smokeNoise(seed, 191 + index) * 6;
    veil.push({
      alpha: 0.075 + smokeNoise(seed, 211 + index) * 0.035,
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance,
      width: 16 + smokeNoise(seed, 233 + index) * 5,
      height: 16 + smokeNoise(seed, 251 + index) * 5,
      phase: smokeNoise(seed, 277 + index) * Math.PI * 2,
    });
  }

  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let index = 0; index < 16; index += 1) {
    const radius = Math.sqrt((index + 0.5) / 16);
    const angle = index * goldenAngle + (smokeNoise(seed, 311 + index) - 0.5) * 0.5;
    texture.push({
      alpha: 0.08 + smokeNoise(seed, 337 + index) * 0.055,
      dx: Math.cos(angle) * radius * 27,
      dy: Math.sin(angle) * radius * 29,
      width: 4.5 + smokeNoise(seed, 359 + index) * 3.5,
      height: 4.2 + smokeNoise(seed, 383 + index) * 3.8,
      phase: smokeNoise(seed, 409 + index) * Math.PI * 2,
    });
  }

  return { body, texture, veil };
}

function smokeFieldSeed(utilityId: string) {
  let hash = 2166136261;
  for (let index = 0; index < utilityId.length; index += 1) {
    hash ^= utilityId.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function smokeNoise(seed: number, index: number) {
  let value = seed ^ Math.imul(index + 1, 374761393);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  value ^= value >>> 16;
  return (value >>> 0) / 4294967295;
}
