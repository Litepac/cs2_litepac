import { Assets, Texture } from "pixi.js";

export type BombDamageFieldSite = {
  bounds: {
    maxX: number;
    maxY: number;
    maxZ: number;
    minX: number;
    minY: number;
    minZ: number;
  };
  label: string;
  mask: string;
  propagationRange: number;
  texture: Texture;
};

export type BombDamageField = {
  compatibleSourceDemoSha256: Set<string>;
  mapId: string;
  radarHeight: number;
  radarWidth: number;
  resourceSha256: string;
  sites: BombDamageFieldSite[];
};

type BombDamageManifest = {
  compatibleSourceDemoSha256: string[];
  formatVersion: number;
  mapId: string;
  radar: {
    height: number;
    width: number;
  };
  resource: {
    sha256: string;
    type: string;
    version: number;
  };
  sites: Array<Omit<BombDamageFieldSite, "texture">>;
};

const fieldCache = new Map<string, Promise<BombDamageField | null>>();

export function loadBombDamageField(mapId: string) {
  const cached = fieldCache.get(mapId);
  if (cached) {
    return cached;
  }

  const pending = loadField(mapId);
  fieldCache.set(mapId, pending);
  return pending;
}

export function resolveBombDamageSite(field: BombDamageField, worldX: number, worldY: number) {
  const margin = 48;
  return (
    field.sites.find(
      (site) =>
        worldX >= site.bounds.minX - margin &&
        worldX <= site.bounds.maxX + margin &&
        worldY >= site.bounds.minY - margin &&
        worldY <= site.bounds.maxY + margin,
    ) ?? null
  );
}

async function loadField(mapId: string): Promise<BombDamageField | null> {
  const baseURL = `/maps/${encodeURIComponent(mapId)}/bomb-damage`;
  try {
    const response = await fetch(`${baseURL}/manifest.json`, { cache: "no-cache" });
    if (!response.ok) {
      return null;
    }
    const manifest = (await response.json()) as BombDamageManifest;
    if (!isValidManifest(manifest, mapId)) {
      return null;
    }

    const sites = await Promise.all(
      manifest.sites.map(async (site) => ({
        ...site,
        texture: await Assets.load<Texture>(`${baseURL}/${encodeURIComponent(site.mask)}`),
      })),
    );
    return {
      compatibleSourceDemoSha256: new Set(manifest.compatibleSourceDemoSha256),
      mapId,
      radarHeight: manifest.radar.height,
      radarWidth: manifest.radar.width,
      resourceSha256: manifest.resource.sha256,
      sites,
    };
  } catch {
    return null;
  }
}

function isValidManifest(value: BombDamageManifest, mapId: string) {
  return (
    value?.formatVersion === 1 &&
    Array.isArray(value.compatibleSourceDemoSha256) &&
    value.compatibleSourceDemoSha256.every((sha256) => /^[a-f0-9]{64}$/.test(sha256)) &&
    value.mapId === mapId &&
    value.resource?.type === "CS2_BOMB_DAMAGE_DATA" &&
    value.resource.version === 1 &&
    /^[A-F0-9]{64}$/.test(value.resource.sha256) &&
    Number.isInteger(value.radar?.width) &&
    value.radar.width > 0 &&
    Number.isInteger(value.radar?.height) &&
    value.radar.height > 0 &&
    Array.isArray(value.sites) &&
    value.sites.length > 0 &&
    value.sites.every(
      (site) =>
        typeof site.label === "string" &&
        typeof site.mask === "string" &&
        Number.isFinite(site.propagationRange) &&
        site.propagationRange > 0 &&
        hasFiniteBounds(site.bounds),
    )
  );
}

function hasFiniteBounds(bounds: BombDamageFieldSite["bounds"]) {
  return (
    bounds != null &&
    [
      bounds.minX,
      bounds.minY,
      bounds.minZ,
      bounds.maxX,
      bounds.maxY,
      bounds.maxZ,
    ].every(Number.isFinite)
  );
}
