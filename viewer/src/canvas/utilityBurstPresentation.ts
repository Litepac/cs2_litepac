export type UtilityBurstKind = "flashbang" | "hegrenade";

export type UtilityBurstPresentation = {
  coreRadius: number;
  fade: number;
  glowRadius: number;
  outerRadius: number;
  rayInnerRadius: number;
  rayOuterRadius: number;
};

export function resolveUtilityBurstPresentation(
  kind: UtilityBurstKind,
  progress: number,
): UtilityBurstPresentation {
  const normalized = clamp(progress, 0, 1);
  const fade = 1 - smoothstep(0.08, 1, normalized);

  if (kind === "flashbang") {
    return {
      coreRadius: mix(7, 11, normalized),
      fade,
      glowRadius: mix(15, 25, normalized),
      outerRadius: mix(23, 34, normalized),
      rayInnerRadius: mix(10, 15, normalized),
      rayOuterRadius: mix(22, 32, normalized),
    };
  }

  return {
    coreRadius: mix(5, 8.5, normalized),
    fade,
    glowRadius: mix(10, 18, normalized),
    outerRadius: mix(15, 23, normalized),
    rayInnerRadius: mix(8, 11, normalized),
    rayOuterRadius: mix(14, 21, normalized),
  };
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const normalized = clamp((value - edge0) / Math.max(0.0001, edge1 - edge0), 0, 1);
  return normalized * normalized * (3 - 2 * normalized);
}

function mix(left: number, right: number, amount: number) {
  return left + (right - left) * amount;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}
