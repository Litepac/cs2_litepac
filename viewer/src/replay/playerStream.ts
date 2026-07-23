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
  z: number | null;
  yaw: number | null;
  pitch: number | null;
  eyeX: number | null;
  eyeY: number | null;
  eyeZ: number | null;
  isScoped: boolean | null;
  zoomLevel: number | null;
  viewmodelFov: number | null;
  viewmodelOffsetX: number | null;
  viewmodelOffsetY: number | null;
  viewmodelOffsetZ: number | null;
  recoilIndex: number | null;
  isWalking: boolean | null;
  isDucking: boolean | null;
  isOnGround: boolean | null;
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
  const pitch = stream.pitch ?? [];
  const eyeX = stream.eyeX ?? [];
  const eyeY = stream.eyeY ?? [];
  const eyeZ = stream.eyeZ ?? [];
  const isScoped = stream.isScoped ?? [];
  const zoomLevel = stream.zoomLevel ?? [];
  const viewmodelFov = stream.viewmodelFov ?? [];
  const viewmodelOffsetX = stream.viewmodelOffsetX ?? [];
  const viewmodelOffsetY = stream.viewmodelOffsetY ?? [];
  const viewmodelOffsetZ = stream.viewmodelOffsetZ ?? [];
  const recoilIndex = stream.recoilIndex ?? [];
  const isWalking = stream.isWalking ?? [];
  const isDucking = stream.isDucking ?? [];
  const isOnGround = stream.isOnGround ?? [];

  return {
    activeWeapon: stream.activeWeapon[baseIndex] ?? null,
    activeWeaponClass: stream.activeWeaponClass[baseIndex] ?? null,
    alive: stream.alive[baseIndex] ?? false,
    hasBomb: stream.hasBomb[baseIndex] ?? false,
    health: stream.health[baseIndex] ?? null,
    mainWeapon: stream.mainWeapon[baseIndex] ?? null,
    x: interpolateNullableNumber(stream.x[baseIndex], stream.x[nextIndex], mix),
    y: interpolateNullableNumber(stream.y[baseIndex], stream.y[nextIndex], mix),
    z: interpolateNullableNumber(stream.z[baseIndex], stream.z[nextIndex], mix),
    yaw: interpolateAngle(stream.yaw[baseIndex], stream.yaw[nextIndex], mix),
    pitch: interpolateNullableNumber(pitch[baseIndex] ?? null, pitch[nextIndex] ?? null, mix),
    eyeX: interpolateNullableNumber(eyeX[baseIndex] ?? null, eyeX[nextIndex] ?? null, mix),
    eyeY: interpolateNullableNumber(eyeY[baseIndex] ?? null, eyeY[nextIndex] ?? null, mix),
    eyeZ: interpolateNullableNumber(eyeZ[baseIndex] ?? null, eyeZ[nextIndex] ?? null, mix),
    isScoped: isScoped[baseIndex] ?? null,
    zoomLevel: zoomLevel[baseIndex] ?? null,
    viewmodelFov: interpolateNullableNumber(viewmodelFov[baseIndex] ?? null, viewmodelFov[nextIndex] ?? null, mix),
    viewmodelOffsetX: interpolateNullableNumber(viewmodelOffsetX[baseIndex] ?? null, viewmodelOffsetX[nextIndex] ?? null, mix),
    viewmodelOffsetY: interpolateNullableNumber(viewmodelOffsetY[baseIndex] ?? null, viewmodelOffsetY[nextIndex] ?? null, mix),
    viewmodelOffsetZ: interpolateNullableNumber(viewmodelOffsetZ[baseIndex] ?? null, viewmodelOffsetZ[nextIndex] ?? null, mix),
    recoilIndex: interpolateNullableNumber(recoilIndex[baseIndex] ?? null, recoilIndex[nextIndex] ?? null, mix),
    isWalking: isWalking[baseIndex] ?? null,
    isDucking: isDucking[baseIndex] ?? null,
    isOnGround: isOnGround[baseIndex] ?? null,
  };
}

function interpolateNullableNumber(left: number | null, right: number | null, mix: number) {
  if (mix <= 0) {
    return left;
  }

  if (mix >= 1) {
    return right;
  }

  if (left == null || right == null) {
    return null;
  }

  return left + (right - left) * mix;
}

function interpolateAngle(left: number | null, right: number | null, mix: number) {
  if (mix <= 0) {
    return left;
  }

  if (mix >= 1) {
    return right;
  }

  if (left == null || right == null) {
    return null;
  }

  const delta = ((((right - left) % 360) + 540) % 360) - 180;
  return left + delta * mix;
}
