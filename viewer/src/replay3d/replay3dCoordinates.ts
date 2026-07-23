import { Vector3 } from "three";

import type { Replay3DCoordinateTransform } from "./mapAssetManifest";

export type Source2WorldPoint = {
  x: number | null;
  y: number | null;
  z: number | null;
};

export function source2PointToGltf(point: Source2WorldPoint, transform: Replay3DCoordinateTransform): Vector3 | null {
  if (!isFiniteNumber(point.x) || !isFiniteNumber(point.y) || !isFiniteNumber(point.z)) {
    return null;
  }

  const scale = transform.scale;
  switch (transform.source2ToGltf) {
    case "identity":
      return new Vector3(point.x * scale, point.y * scale, point.z * scale);
    case "source2viewer-yzx":
      return new Vector3(point.y * scale, point.z * scale, point.x * scale);
    case "xzy-negative-y":
    default:
      return new Vector3(point.x * scale, point.z * scale, -point.y * scale);
  }
}

export function source2YawToGltfRadians(yawDegrees: number | null, transform: Replay3DCoordinateTransform) {
  if (!isFiniteNumber(yawDegrees)) {
    return 0;
  }

  switch (transform.source2ToGltf) {
    case "identity":
      return (yawDegrees * Math.PI) / 180;
    case "source2viewer-yzx":
      return (yawDegrees * Math.PI) / 180;
    case "xzy-negative-y":
    default:
      return (-yawDegrees * Math.PI) / 180;
  }
}

function isFiniteNumber(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
