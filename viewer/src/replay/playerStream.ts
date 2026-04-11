import type { Round } from "./types";
import type { WeaponClass } from "./weapons";

export type InterpolatedPlayerStreamSample = {
  activeWeapon: string | null;
  activeWeaponClass: WeaponClass | null;
  alive: boolean;
  hasBomb: boolean;
  health: number | null;
  mainWeapon: string | null;
  x: number | null;
  y: number | null;
  yaw: number | null;
};

export function interpolatePlayerStreamSample(
  stream: Round["playerStreams"][number],
  currentTick: number,
): InterpolatedPlayerStreamSample | null {
  const sampleIntervalTicks = Math.max(1, stream.sampleIntervalTicks || 1);
  const relativeTick = currentTick - stream.sampleOriginTick;
  const lastSampleTick = stream.sampleOriginTick + sampleIntervalTicks * Math.max(0, stream.x.length - 1);
  if (currentTick > lastSampleTick) {
    return null;
  }

  const relativeSampleIndex = relativeTick / sampleIntervalTicks;
  const baseIndex = Math.floor(relativeSampleIndex);
  if (baseIndex < 0 || baseIndex >= stream.x.length) {
    return null;
  }

  const nextIndex = Math.min(stream.x.length - 1, baseIndex + 1);
  const mix = Math.max(0, Math.min(1, relativeSampleIndex - baseIndex));

  return {
    activeWeapon: stream.activeWeapon[baseIndex] ?? null,
    activeWeaponClass: stream.activeWeaponClass[baseIndex] ?? null,
    alive: stream.alive[baseIndex] ?? false,
    hasBomb: stream.hasBomb[baseIndex] ?? false,
    health: stream.health[baseIndex] ?? null,
    mainWeapon: stream.mainWeapon[baseIndex] ?? null,
    x: interpolateNullableNumber(stream.x[baseIndex], stream.x[nextIndex], mix),
    y: interpolateNullableNumber(stream.y[baseIndex], stream.y[nextIndex], mix),
    yaw: interpolateAngle(stream.yaw[baseIndex], stream.yaw[nextIndex], mix),
  };
}

function interpolateNullableNumber(left: number | null, right: number | null, mix: number) {
  if (left == null && right == null) {
    return null;
  }

  if (left == null) {
    return right;
  }

  if (right == null) {
    return left;
  }

  return left + (right - left) * mix;
}

function interpolateAngle(left: number | null, right: number | null, mix: number) {
  if (mix <= 0) {
    return left ?? right;
  }

  if (mix >= 1) {
    return right ?? left;
  }

  if (left == null || right == null) {
    return null;
  }

  const delta = ((((right - left) % 360) + 540) % 360) - 180;
  return left + delta * mix;
}
