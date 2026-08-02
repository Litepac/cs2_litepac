export type UtilityBurstKind = "flashbang" | "hegrenade";

export type UtilityBurstPresentation = {
  coreRadius: number;
  fade: number;
  glowRadius: number;
  outerRadius: number;
  rayInnerRadius: number;
  rayOuterRadius: number;
  shockRadius: number;
};

export function resolveUtilityBurstPresentation(
  kind: UtilityBurstKind,
  progress: number,
  maximumFlashRadius = 112,
): UtilityBurstPresentation {
  const normalized = clamp(progress, 0, 1);

  if (kind === "flashbang") {
    const expansion = easeOutCubic(normalized);

    return {
      coreRadius: mix(12, 22, expansion),
      fade: 1 - smoothstep(0.38, 1, normalized),
      glowRadius: mix(34, maximumFlashRadius * 0.72, expansion),
      outerRadius: mix(50, maximumFlashRadius * 0.93, expansion),
      rayInnerRadius: mix(18, 32, expansion),
      rayOuterRadius: mix(46, maximumFlashRadius * 0.92, expansion),
      shockRadius: mix(28, maximumFlashRadius, expansion),
    };
  }

  const fade = 1 - smoothstep(0.08, 1, normalized);
  return {
    coreRadius: mix(5, 8.5, normalized),
    fade,
    glowRadius: mix(10, 18, normalized),
    outerRadius: mix(15, 23, normalized),
    rayInnerRadius: mix(8, 11, normalized),
    rayOuterRadius: mix(14, 21, normalized),
    shockRadius: mix(15, 23, normalized),
  };
}

export function resolveResponsiveFlashBurstRadius(viewportWidth: number, viewportHeight: number) {
  const shortestDimension = Math.min(
    Number.isFinite(viewportWidth) ? viewportWidth : 0,
    Number.isFinite(viewportHeight) ? viewportHeight : 0,
  );
  return clamp(shortestDimension * 0.48, 220, 380);
}

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3);
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
