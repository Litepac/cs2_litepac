export type SmokeFootprintPuff = {
  alpha: number;
  color: number;
  dx: number;
  dy: number;
  height: number;
  phase: number;
  width: number;
};

export type SmokeFootprintWisp = {
  alpha: number;
  c1x: number;
  c1y: number;
  c2x: number;
  c2y: number;
  color: number;
  ex: number;
  ey: number;
  sx: number;
  sy: number;
  width: number;
};

export type SmokeFootprint = {
  bodyCells: SmokeFootprintPuff[];
  bodyPuffs: SmokeFootprintPuff[];
  corePuffs: SmokeFootprintPuff[];
  edgePuffs: SmokeFootprintPuff[];
  highlights: SmokeFootprintPuff[];
  shadowPuffs: SmokeFootprintPuff[];
  wisps: SmokeFootprintWisp[];
};

const SMOKE_FOOTPRINT_CACHE_LIMIT = 256;
const smokeFootprintCache = new Map<string, SmokeFootprint>();

export function getSmokeFootprint(utilityId: string, throwerSide: "T" | "CT" | null) {
  const key = `${utilityId}:${throwerSide ?? "U"}`;
  const cached = smokeFootprintCache.get(key);
  if (cached) {
    return cached;
  }

  const footprint = createSmokeFootprint(utilityId, throwerSide);
  smokeFootprintCache.set(key, footprint);
  if (smokeFootprintCache.size > SMOKE_FOOTPRINT_CACHE_LIMIT) {
    const oldestKey = smokeFootprintCache.keys().next().value;
    if (oldestKey) {
      smokeFootprintCache.delete(oldestKey);
    }
  }
  return footprint;
}

function createSmokeFootprint(utilityId: string, throwerSide: "T" | "CT" | null) {
  const seed = smokeFootprintSeed(utilityId, throwerSide);
  const bodyCells: SmokeFootprintPuff[] = [];
  const bodyPuffs: SmokeFootprintPuff[] = [];
  const edgePuffs: SmokeFootprintPuff[] = [];
  const shadowPuffs: SmokeFootprintPuff[] = [];
  const corePuffs: SmokeFootprintPuff[] = [];
  const highlights: SmokeFootprintPuff[] = [];
  const wisps: SmokeFootprintWisp[] = [];
  const cellColors = [0xaab4ba, 0xb9c2c7, 0xc9d1d5, 0xdce3e6, 0x98a4aa];

  for (let index = 0; index < 34; index += 1) {
    const sample = smokeFootprintSample(seed, index, 27.5, 33.5);
    const edge = Math.max(Math.abs(sample.nx), Math.abs(sample.ny));
    const distance = Math.hypot(sample.nx * 0.82, sample.ny);
    const phase = smokeNoise(seed, index + 53) * Math.PI * 2;
    const color = cellColors[Math.floor(smokeNoise(seed, index + 79) * cellColors.length)] ?? 0xb9c2c7;

    if (index < 24) {
      bodyCells.push({
        dx: sample.dx,
        dy: sample.dy,
        width: 24 + smokeNoise(seed, index + 149) * 12,
        height: 22 + smokeNoise(seed, index + 173) * 11,
        alpha: 0.12 + Math.max(0, 1 - distance) * 0.18,
        color,
        phase,
      });
    }

    if (index % 3 === 0 || distance < 0.56 || edge > 0.8) {
      bodyPuffs.push({
        dx: sample.dx + (smokeNoise(seed, index + 197) - 0.5) * 2.1,
        dy: sample.dy + (smokeNoise(seed, index + 211) - 0.5) * 2.1,
        width: 6.8 + smokeNoise(seed, index + 101) * 2.8,
        height: 7.2 + smokeNoise(seed, index + 127) * 3.2,
        alpha: 0.06 + Math.max(0, 1 - edge) * 0.06,
        color: distance < 0.56 ? 0xe2e8eb : color,
        phase,
      });
    }

    if (edge > 0.82 || index > 29) {
      edgePuffs.push({
        dx: sample.dx,
        dy: sample.dy,
        width: 5 + smokeNoise(seed, index + 229) * 2.5,
        height: 5.3 + smokeNoise(seed, index + 251) * 2.8,
        alpha: 0.08 + smokeNoise(seed, index + 271) * 0.06,
        color: smokeNoise(seed, index + 283) > 0.45 ? 0x87939a : 0xacb6bc,
        phase,
      });
      shadowPuffs.push({
        dx: sample.dx + (smokeNoise(seed, index + 307) - 0.5) * 1.8,
        dy: sample.dy + 1.6 + (smokeNoise(seed, index + 331) - 0.5) * 1.8,
        width: 7 + smokeNoise(seed, index + 353) * 3.6,
        height: 5.6 + smokeNoise(seed, index + 379) * 3.2,
        alpha: 0.03 + smokeNoise(seed, index + 397) * 0.025,
        color: 0x030405,
        phase,
      });
    }

    if (distance < 0.66 && smokeNoise(seed, index + 419) > 0.1) {
      corePuffs.push({
        dx: sample.dx * 0.62,
        dy: sample.dy * 0.62,
        width: 11 + smokeNoise(seed, index + 443) * 5.5,
        height: 10 + smokeNoise(seed, index + 467) * 5,
        alpha: 0.13 + smokeNoise(seed, index + 491) * 0.13,
        color: smokeNoise(seed, index + 503) > 0.34 ? 0xffffff : 0xeaf0f3,
        phase,
      });
    }

    if (distance < 0.48 && smokeNoise(seed, index + 521) > 0.72) {
      highlights.push({
        dx: sample.dx,
        dy: sample.dy,
        width: 6 + smokeNoise(seed, index + 547) * 4.2,
        height: 2.3 + smokeNoise(seed, index + 571) * 1.8,
        alpha: 0.026 + smokeNoise(seed, index + 593) * 0.032,
        color: 0xffffff,
        phase,
      });
    }
  }

  for (let wispIndex = 0; wispIndex < 6; wispIndex += 1) {
    const startAngle = smokeNoise(seed, 700 + wispIndex * 17) * Math.PI * 2;
    const endAngle = startAngle + (smokeNoise(seed, 711 + wispIndex * 17) - 0.5) * 1.25;
    const startRadius = 10 + smokeNoise(seed, 727 + wispIndex * 17) * 11;
    const endRadius = 13 + smokeNoise(seed, 739 + wispIndex * 17) * 14;
    wisps.push({
      sx: Math.cos(startAngle) * startRadius,
      sy: Math.sin(startAngle) * startRadius * 1.12,
      c1x: Math.cos(startAngle + 0.7) * (startRadius + 7),
      c1y: Math.sin(startAngle + 0.7) * (startRadius + 4),
      c2x: Math.cos(endAngle - 0.6) * (endRadius + 5),
      c2y: Math.sin(endAngle - 0.6) * (endRadius + 5),
      ex: Math.cos(endAngle) * endRadius,
      ey: Math.sin(endAngle) * endRadius * 1.08,
      alpha: 0.055 + smokeNoise(seed, 751 + wispIndex * 17) * 0.07,
      width: 1.05 + smokeNoise(seed, 763 + wispIndex * 17) * 1.2,
      color: smokeNoise(seed, 777 + wispIndex * 17) > 0.45 ? 0xf3f7f9 : 0x66747c,
    });
  }

  bodyCells.sort((left, right) => Math.hypot(left.dx, left.dy) - Math.hypot(right.dx, right.dy));

  return {
    bodyCells,
    bodyPuffs,
    corePuffs,
    edgePuffs,
    highlights,
    shadowPuffs,
    wisps,
  };
}

function smokeFootprintSample(seed: number, index: number, halfWidth: number, halfHeight: number) {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const radiusJitter = (smokeNoise(seed, index * 17 + 41) - 0.5) * 0.08;
  const angleJitter = (smokeNoise(seed, index * 19 + 71) - 0.5) * 0.72;
  const radius = Math.max(0.12, Math.min(0.98, Math.sqrt((index + 0.5) / 34) + radiusJitter));
  const angle = index * goldenAngle + angleJitter;
  const squash = 0.9 + smokeNoise(seed, index * 23 + 107) * 0.18;
  const dx = Math.cos(angle) * halfWidth * radius * squash;
  const dy = Math.sin(angle) * halfHeight * radius * (0.88 + smokeNoise(seed, index * 29 + 131) * 0.16);
  return {
    dx,
    dy,
    nx: dx / halfWidth,
    ny: dy / halfHeight,
  };
}

function smokeFootprintSeed(utilityId: string, throwerSide: "T" | "CT" | null) {
  let hash = 2166136261;
  const key = `${utilityId}:${throwerSide ?? "U"}`;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
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
