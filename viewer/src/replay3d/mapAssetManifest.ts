export type Replay3DCoordinateTransform = {
  scale: number;
  source2ToGltf: "identity" | "source2viewer-yzx" | "xzy-negative-y";
};

export type Replay3DMapAssetManifest = {
  assetPath: string;
  coordinateTransform?: Partial<Replay3DCoordinateTransform>;
  displayName?: string;
  exportedAt?: string;
  source?: string;
};

export type Replay3DMapAssetResult =
  | {
      available: true;
      assetUrl: string;
      baseUrl: string;
      coordinateTransform: Replay3DCoordinateTransform;
      displayName: string | null;
      source: string | null;
    }
  | {
      available: false;
      manifestUrl: string;
      reason: string;
    };

const DEFAULT_COORDINATE_TRANSFORM: Replay3DCoordinateTransform = {
  scale: 0.0254,
  source2ToGltf: "source2viewer-yzx",
};

export async function loadReplay3DMapAsset(mapId: string): Promise<Replay3DMapAssetResult> {
  const baseUrl = `/maps/${encodeURIComponent(mapId)}/3d`;
  const manifestUrl = `${baseUrl}/manifest.json`;

  try {
    const response = await fetch(manifestUrl, { cache: "no-store" });
    if (response.ok) {
      const manifest = (await response.json()) as Partial<Replay3DMapAssetManifest>;
      const assetPath = typeof manifest.assetPath === "string" ? manifest.assetPath.trim() : "";
      if (!assetPath) {
        return {
          available: false,
          manifestUrl,
          reason: "3D asset manifest exists, but it does not name a glTF/GLB asset.",
        };
      }

      return {
        available: true,
        assetUrl: normalizeAssetUrl(baseUrl, assetPath),
        baseUrl,
        coordinateTransform: {
          ...DEFAULT_COORDINATE_TRANSFORM,
          ...manifest.coordinateTransform,
        },
        displayName: typeof manifest.displayName === "string" ? manifest.displayName : null,
        source: typeof manifest.source === "string" ? manifest.source : null,
      };
    }
  } catch {
    return {
      available: false,
      manifestUrl,
      reason: "3D map assets are not exported for this map yet.",
    };
  }

  return {
    available: false,
    manifestUrl,
    reason: "3D map assets are not exported for this map yet.",
  };
}

function normalizeAssetUrl(baseUrl: string, assetPath: string) {
  if (assetPath.startsWith("/")) {
    return assetPath;
  }

  return `${baseUrl}/${assetPath.replace(/^\.?\//, "")}`;
}
