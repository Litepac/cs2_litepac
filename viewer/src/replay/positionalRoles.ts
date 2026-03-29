import type { Replay } from "./types";
import type { SideRoleTendency } from "./statsTypes";

type Side = "T" | "CT";

type ZoneRect = {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
};

type ZoneDefinition = {
  name: string;
  ctLabel: string;
  tLabel: string;
  rects: ZoneRect[];
};

type ZoneTally = {
  byName: Map<string, number>;
  totalSamples: number;
};

type SideZoneTallies = {
  CT: ZoneTally;
  T: ZoneTally;
};

export type SideZoneShare = {
  zoneName: string;
  ctLabel: string;
  tLabel: string;
  samples: number;
  share: number;
};

type SideRoleSampling = {
  startDelaySeconds?: number;
  windowSeconds?: number;
};

const POSITION_SAMPLE_STRIDE = 16;
const CT_ROLE_OCCUPANCY_WINDOW_SECONDS = 24;
const T_ROLE_OCCUPANCY_WINDOW_SECONDS = 16;
const MIN_ZONE_SHARE = 0.27;
const COMBO_SHARE = 0.2;
const COMBO_DELTA = 0.05;
const PREFERRED_PRIMARY_DELTA = 0.08;

const T_ROUTE_LABELS = new Set([
  "A Long",
  "A Lobby",
  "A Main",
  "A Ramp",
  "Apartments",
  "Arch / Library",
  "B Halls",
  "B Lane",
  "B Tunnels",
  "Banana",
  "Boiler",
  "Canal",
  "Catwalk",
  "Cave",
  "Connector",
  "Connector / Mid",
  "Donut",
  "Ivy",
  "Long A",
  "Lobby / Hut",
  "Main / Pop",
  "Mid",
  "Monster",
  "Outside",
  "Palace / Ramp",
  "Ramp",
  "Short / Water",
]);

const MID_LIKE_ZONE_NAMES = new Set(["Mid", "Top Mid", "Second Mid", "Connector / Mid"]);

const MAP_ROLE_SAMPLING: Partial<Record<Replay["map"]["mapId"], Partial<Record<Side, SideRoleSampling>>>> = {
  de_inferno: {
    T: {
      startDelaySeconds: 7,
      windowSeconds: 12,
    },
  },
};

const MAP_ZONES: Record<string, ZoneDefinition[]> = {
  de_ancient: [
    { name: "A Site", ctLabel: "A Anchor", tLabel: "A Hit", rects: [{ xMin: 0.02, xMax: 0.27, yMin: 0.12, yMax: 0.34 }] },
    { name: "Cave", ctLabel: "A Rotation", tLabel: "Cave", rects: [{ xMin: 0.0, xMax: 0.24, yMin: 0.39, yMax: 0.88 }] },
    { name: "Donut", ctLabel: "Mid Rotation", tLabel: "Donut", rects: [{ xMin: 0.22, xMax: 0.43, yMin: 0.18, yMax: 0.44 }] },
    { name: "Mid", ctLabel: "Mid Rotation", tLabel: "Mid", rects: [{ xMin: 0.36, xMax: 0.72, yMin: 0.3, yMax: 0.62 }] },
    { name: "B Lane", ctLabel: "B Anchor", tLabel: "B Lane", rects: [{ xMin: 0.56, xMax: 0.98, yMin: 0.16, yMax: 0.44 }] },
    { name: "B Site", ctLabel: "B Anchor", tLabel: "B Hit", rects: [{ xMin: 0.72, xMax: 0.97, yMin: 0.18, yMax: 0.42 }] },
  ],
  de_inferno: [
    { name: "Banana", ctLabel: "B Anchor", tLabel: "Banana", rects: [{ xMin: 0.2, xMax: 0.43, yMin: 0.14, yMax: 0.46 }] },
    { name: "B Site", ctLabel: "B Anchor", tLabel: "B Hit", rects: [{ xMin: 0.16, xMax: 0.38, yMin: 0.0, yMax: 0.16 }] },
    { name: "Apartments", ctLabel: "A Anchor", tLabel: "Apartments", rects: [{ xMin: 0.73, xMax: 0.97, yMin: 0.03, yMax: 0.29 }] },
    { name: "Second Mid", ctLabel: "Mid Rotation", tLabel: "Second Mid", rects: [{ xMin: 0.33, xMax: 0.51, yMin: 0.54, yMax: 0.75 }] },
    { name: "Boiler", ctLabel: "Mid Rotation", tLabel: "Boiler", rects: [{ xMin: 0.58, xMax: 0.71, yMin: 0.43, yMax: 0.58 }] },
    { name: "Top Mid", ctLabel: "Mid Rotation", tLabel: "Top Mid", rects: [{ xMin: 0.41, xMax: 0.59, yMin: 0.32, yMax: 0.60 }] },
    { name: "Arch", ctLabel: "Mid Rotation", tLabel: "Arch", rects: [{ xMin: 0.55, xMax: 0.67, yMin: 0.24, yMax: 0.40 }] },
    { name: "Library", ctLabel: "A Rotation", tLabel: "Arch / Library", rects: [{ xMin: 0.66, xMax: 0.79, yMin: 0.17, yMax: 0.34 }] },
    { name: "Short", ctLabel: "A Anchor", tLabel: "Short", rects: [{ xMin: 0.67, xMax: 0.84, yMin: 0.42, yMax: 0.60 }] },
    { name: "A Site / Pit", ctLabel: "A Anchor", tLabel: "A Hit", rects: [{ xMin: 0.73, xMax: 0.96, yMin: 0.52, yMax: 0.86 }] },
  ],
  de_mirage: [
    { name: "A Site", ctLabel: "A Anchor", tLabel: "A Hit", rects: [{ xMin: 0.03, xMax: 0.35, yMin: 0.04, yMax: 0.27 }] },
    { name: "Palace / Ramp", ctLabel: "A Anchor", tLabel: "Palace / Ramp", rects: [{ xMin: 0.0, xMax: 0.28, yMin: 0.24, yMax: 0.63 }] },
    { name: "Mid", ctLabel: "Mid Rotation", tLabel: "Mid", rects: [{ xMin: 0.34, xMax: 0.66, yMin: 0.16, yMax: 0.56 }] },
    { name: "Connector / Jungle", ctLabel: "A Rotation", tLabel: "Mid / Connector", rects: [{ xMin: 0.34, xMax: 0.69, yMin: 0.54, yMax: 0.78 }] },
    { name: "Apartments", ctLabel: "B Anchor", tLabel: "Apartments", rects: [{ xMin: 0.71, xMax: 0.95, yMin: 0.05, yMax: 0.39 }] },
    { name: "B Site", ctLabel: "B Anchor", tLabel: "B Hit", rects: [{ xMin: 0.65, xMax: 0.97, yMin: 0.57, yMax: 0.95 }] },
  ],
  de_anubis: [
    { name: "A Site", ctLabel: "A Anchor", tLabel: "A Hit", rects: [{ xMin: 0.71, xMax: 0.96, yMin: 0.04, yMax: 0.29 }] },
    { name: "Temple", ctLabel: "Rotation", tLabel: "A Main", rects: [{ xMin: 0.16, xMax: 0.48, yMin: 0.01, yMax: 0.24 }] },
    { name: "Mid", ctLabel: "Mid Rotation", tLabel: "Mid", rects: [{ xMin: 0.33, xMax: 0.68, yMin: 0.24, yMax: 0.63 }] },
    { name: "B Site", ctLabel: "B Anchor", tLabel: "B Hit", rects: [{ xMin: 0.14, xMax: 0.39, yMin: 0.33, yMax: 0.58 }] },
    { name: "Canal", ctLabel: "B Anchor", tLabel: "Canal", rects: [{ xMin: 0.04, xMax: 0.38, yMin: 0.61, yMax: 0.96 }] },
    { name: "A Main", ctLabel: "Rotation", tLabel: "A Main", rects: [{ xMin: 0.54, xMax: 0.9, yMin: 0.64, yMax: 0.95 }] },
  ],
  de_dust2: [
    { name: "Long A", ctLabel: "A Anchor", tLabel: "Long A", rects: [{ xMin: 0.0, xMax: 0.34, yMin: 0.0, yMax: 0.22 }] },
    { name: "A Site", ctLabel: "A Anchor", tLabel: "A Hit", rects: [{ xMin: 0.0, xMax: 0.18, yMin: 0.0, yMax: 0.14 }] },
    { name: "Mid", ctLabel: "Mid Rotation", tLabel: "Mid", rects: [{ xMin: 0.28, xMax: 0.68, yMin: 0.12, yMax: 0.72 }] },
    { name: "Catwalk", ctLabel: "A Rotation", tLabel: "Catwalk", rects: [{ xMin: 0.55, xMax: 0.82, yMin: 0.06, yMax: 0.22 }] },
    { name: "B Tunnels", ctLabel: "B Rotation", tLabel: "B Tunnels", rects: [{ xMin: 0.0, xMax: 0.34, yMin: 0.56, yMax: 0.98 }] },
    { name: "B Site", ctLabel: "B Anchor", tLabel: "B Hit", rects: [{ xMin: 0.74, xMax: 0.98, yMin: 0.02, yMax: 0.19 }] },
  ],
  de_nuke: [
    { name: "Lobby / Hut", ctLabel: "A Rotation", tLabel: "Lobby / Hut", rects: [{ xMin: 0.0, xMax: 0.42, yMin: 0.18, yMax: 0.56 }] },
    { name: "Ramp", ctLabel: "Ramp Hold", tLabel: "Ramp", rects: [{ xMin: 0.42, xMax: 0.78, yMin: 0.44, yMax: 0.82 }] },
    { name: "A Site", ctLabel: "A Anchor", tLabel: "A Hit", rects: [{ xMin: 0.34, xMax: 0.66, yMin: 0.16, yMax: 0.42 }] },
    { name: "Outside", ctLabel: "Yard", tLabel: "Outside", rects: [{ xMin: 0.64, xMax: 0.99, yMin: 0.16, yMax: 0.44 }] },
  ],
  de_overpass: [
    { name: "A Site", ctLabel: "A Anchor", tLabel: "A Hit", rects: [{ xMin: 0.22, xMax: 0.48, yMin: 0.0, yMax: 0.18 }] },
    { name: "A Long", ctLabel: "A Rotation", tLabel: "A Long", rects: [{ xMin: 0.0, xMax: 0.3, yMin: 0.17, yMax: 0.58 }] },
    { name: "Connector / Mid", ctLabel: "Mid Rotation", tLabel: "Connector / Mid", rects: [{ xMin: 0.28, xMax: 0.56, yMin: 0.2, yMax: 0.58 }] },
    { name: "B Site", ctLabel: "B Anchor", tLabel: "B Hit", rects: [{ xMin: 0.57, xMax: 0.9, yMin: 0.08, yMax: 0.33 }] },
    { name: "Short / Water", ctLabel: "B Rotation", tLabel: "Short / Water", rects: [{ xMin: 0.56, xMax: 0.95, yMin: 0.33, yMax: 0.74 }] },
    { name: "Monster", ctLabel: "B Anchor", tLabel: "Monster", rects: [{ xMin: 0.6, xMax: 0.98, yMin: 0.7, yMax: 0.99 }] },
  ],
  de_train: [
    { name: "A Site", ctLabel: "A Anchor", tLabel: "A Hit", rects: [{ xMin: 0.34, xMax: 0.6, yMin: 0.36, yMax: 0.68 }] },
    { name: "Ivy", ctLabel: "A Rotation", tLabel: "Ivy", rects: [{ xMin: 0.56, xMax: 0.9, yMin: 0.18, yMax: 0.58 }] },
    { name: "Main / Pop", ctLabel: "A Rotation", tLabel: "Main / Pop", rects: [{ xMin: 0.1, xMax: 0.43, yMin: 0.42, yMax: 0.82 }] },
    { name: "Connector / Z", ctLabel: "Mid Rotation", tLabel: "Connector", rects: [{ xMin: 0.31, xMax: 0.57, yMin: 0.16, yMax: 0.36 }] },
    { name: "B Halls", ctLabel: "B Rotation", tLabel: "B Halls", rects: [{ xMin: 0.04, xMax: 0.28, yMin: 0.08, yMax: 0.34 }] },
    { name: "B Site", ctLabel: "B Anchor", tLabel: "B Hit", rects: [{ xMin: 0.0, xMax: 0.29, yMin: 0.34, yMax: 0.65 }] },
  ],
  de_vertigo: [
    { name: "A Ramp", ctLabel: "A Rotation", tLabel: "A Ramp", rects: [{ xMin: 0.5, xMax: 0.86, yMin: 0.12, yMax: 0.47 }] },
    { name: "A Site", ctLabel: "A Anchor", tLabel: "A Hit", rects: [{ xMin: 0.63, xMax: 0.96, yMin: 0.0, yMax: 0.2 }] },
    { name: "Mid", ctLabel: "Mid Rotation", tLabel: "Mid", rects: [{ xMin: 0.36, xMax: 0.66, yMin: 0.32, yMax: 0.68 }] },
    { name: "B Stairs", ctLabel: "B Rotation", tLabel: "B Stairs", rects: [{ xMin: 0.09, xMax: 0.36, yMin: 0.42, yMax: 0.83 }] },
    { name: "B Site", ctLabel: "B Anchor", tLabel: "B Hit", rects: [{ xMin: 0.0, xMax: 0.32, yMin: 0.18, yMax: 0.42 }] },
    { name: "A Lobby / T Spawn", ctLabel: "Mid Rotation", tLabel: "A Lobby", rects: [{ xMin: 0.55, xMax: 0.96, yMin: 0.47, yMax: 0.94 }] },
  ],
};

export function createEmptySideZoneTallies(): SideZoneTallies {
  return {
    CT: { byName: new Map(), totalSamples: 0 },
    T: { byName: new Map(), totalSamples: 0 },
  };
}

export function accumulateStreamZoneOccupancy(
  replayMap: Replay["map"],
  round: Replay["rounds"][number],
  stream: Replay["rounds"][number]["playerStreams"][number],
  tallies: SideZoneTallies,
  tickRate: number,
) {
  if (stream.side == null) {
    return;
  }

  const mapZones = MAP_ZONES[replayMap.mapId];
  if (!mapZones || stream.alive.length === 0) {
    return;
  }

  const baseStartTick = round.freezeEndTick ?? round.startTick;
  const samplingConfig = MAP_ROLE_SAMPLING[replayMap.mapId]?.[stream.side];
  const startDelayTicks = Math.max(0, Math.round(Math.max(1, tickRate) * (samplingConfig?.startDelaySeconds ?? 0)));
  const startTick = baseStartTick + startDelayTicks;
  const startIndex = Math.max(0, startTick - stream.sampleOriginTick);
  const roleWindowSeconds = samplingConfig?.windowSeconds ?? (stream.side === "T" ? T_ROLE_OCCUPANCY_WINDOW_SECONDS : CT_ROLE_OCCUPANCY_WINDOW_SECONDS);
  const roleWindowTicks = Math.max(1, Math.round(Math.max(1, tickRate) * roleWindowSeconds));
  const roleWindowEndTick = startTick + roleWindowTicks;
  const maxPlayableTick = Math.max(startTick, Math.min(round.endTick, roleWindowEndTick));
  const endIndex = Math.min(stream.alive.length - 1, maxPlayableTick - stream.sampleOriginTick);
  const tally = tallies[stream.side];

  for (let index = startIndex; index <= endIndex; index += POSITION_SAMPLE_STRIDE) {
    if (!stream.alive[index]) {
      continue;
    }

    const x = stream.x[index];
    const y = stream.y[index];
    if (x == null || y == null) {
      continue;
    }

    const zone = classifyZone(replayMap, x, y);
    if (!zone) {
      continue;
    }

    tally.totalSamples += 1;
    tally.byName.set(zone.name, (tally.byName.get(zone.name) ?? 0) + 1);
  }
}

export function deriveSideRoleTendency(replayMap: Replay["map"], side: Side, tally: SideZoneTallies[Side]): SideRoleTendency | null {
  const mapZones = MAP_ZONES[replayMap.mapId];
  if (!mapZones || tally.totalSamples <= 0) {
    return null;
  }

  const ranked = Array.from(tally.byName.entries())
    .map(([zoneName, samples]) => ({
      zone: mapZones.find((entry) => entry.name === zoneName)!,
      samples,
      share: samples / tally.totalSamples,
    }))
    .sort((left, right) => right.samples - left.samples);

  if (ranked.length === 0) {
    return null;
  }

  let top = ranked[0]!;
  let second: (typeof ranked)[number] | undefined = ranked[1];
  const preferredPrimary = side === "CT" ? preferCtPrimary(top, ranked) : preferTPrimary(top, ranked);
  if (preferredPrimary) {
    top = preferredPrimary;
    second = ranked.find((entry) => entry.zone.name !== top.zone.name);
  }

  const mapSpecificTendency = deriveMapSpecificTendency(replayMap.mapId, side, top, second);
  if (mapSpecificTendency) {
    return mapSpecificTendency;
  }

  if (top.share < MIN_ZONE_SHARE) {
    return {
      label: side === "CT" ? "Allround" : "Allround",
      zoneLabel: null,
      occupancyShare: top.share,
    };
  }

  if (second && top.share >= COMBO_SHARE && second.share >= COMBO_SHARE && Math.abs(top.share - second.share) <= COMBO_DELTA) {
    const combinedLabel = side === "CT" ? combineCtLabels(top.zone, second.zone) : combineTLabels(top.zone, second.zone);
    return {
      label: combinedLabel,
      zoneLabel: `${top.zone.name} / ${second.zone.name}`,
      occupancyShare: top.share,
    };
  }

  return {
    label: side === "CT" ? top.zone.ctLabel : top.zone.tLabel,
    zoneLabel: top.zone.name,
    occupancyShare: top.share,
  };
}

function deriveMapSpecificTendency(
  mapId: Replay["map"]["mapId"],
  side: Side,
  top: { zone: ZoneDefinition; samples: number; share: number },
  second: { zone: ZoneDefinition; samples: number; share: number } | undefined,
): SideRoleTendency | null {
  if (mapId === "de_inferno") {
    return side === "CT" ? deriveInfernoCtTendency(top, second) : deriveInfernoTTendency(top, second);
  }

  return null;
}

function deriveInfernoCtTendency(
  top: { zone: ZoneDefinition; samples: number; share: number },
  second: { zone: ZoneDefinition; samples: number; share: number } | undefined,
): SideRoleTendency | null {
  if (!second) {
    return {
      label: top.zone.ctLabel,
      zoneLabel: top.zone.name,
      occupancyShare: top.share,
    };
  }

  const pair = [top.zone.name, second.zone.name];
  const has = (name: string) => pair.includes(name);

  if (has("A Site / Pit") && has("Apartments")) {
    return {
      label: "A Anchor",
      zoneLabel: "A Site / Apartments",
      occupancyShare: top.share,
    };
  }

  if (has("A Site / Pit") && has("Short")) {
    return {
      label: "A Anchor",
      zoneLabel: "A Site / Short",
      occupancyShare: top.share,
    };
  }

  if (has("A Site / Pit") && has("Library") && second.share >= 0.16) {
    return {
      label: "A Rotation",
      zoneLabel: "A Site / Library",
      occupancyShare: top.share,
    };
  }

  if (has("A Site / Pit") && has("Arch") && second.share >= 0.16) {
    return {
      label: "A Rotation",
      zoneLabel: "A Site / Arch",
      occupancyShare: top.share,
    };
  }

  if (has("Library") && has("Short")) {
    return {
      label: "A Rotation",
      zoneLabel: "Library / Short",
      occupancyShare: top.share,
    };
  }

  if (has("Arch") && has("Short")) {
    return {
      label: "A Rotation",
      zoneLabel: "Arch / Short",
      occupancyShare: top.share,
    };
  }

  if (has("Library") && has("Top Mid")) {
    return {
      label: "A Rotation",
      zoneLabel: "Library / Top Mid",
      occupancyShare: top.share,
    };
  }

  if (has("Arch") && has("Top Mid")) {
    return {
      label: "Mid Rotation",
      zoneLabel: "Arch / Top Mid",
      occupancyShare: top.share,
    };
  }

  if (has("A Site / Pit") && has("Boiler")) {
    return {
      label: "A Anchor",
      zoneLabel: "A Site / Boiler",
      occupancyShare: top.share,
    };
  }

  if (has("Banana") && has("B Site")) {
    return {
      label: "B Anchor",
      zoneLabel: "Banana / B Site",
      occupancyShare: top.share,
    };
  }

  return null;
}

function deriveInfernoTTendency(
  top: { zone: ZoneDefinition; samples: number; share: number },
  second: { zone: ZoneDefinition; samples: number; share: number } | undefined,
): SideRoleTendency | null {
  if (!second) {
    return {
      label: top.zone.tLabel,
      zoneLabel: top.zone.name,
      occupancyShare: top.share,
    };
  }

  const pair = [top.zone.name, second.zone.name];
  const has = (name: string) => pair.includes(name);
  const pairShare = top.share + second.share;
  const secondShare = second.share;

  if (has("Banana") && has("B Site")) {
    return {
      label: "Banana",
      zoneLabel: "Banana / B Site",
      occupancyShare: top.share,
    };
  }

  if (has("Apartments") && has("A Site / Pit")) {
    return {
      label: "Apartments",
      zoneLabel: "Apartments / A Site",
      occupancyShare: top.share,
    };
  }

  if (has("Apartments") && has("Short")) {
    return {
      label: "Apartments",
      zoneLabel: "Apartments / Short",
      occupancyShare: top.share,
    };
  }

  if (top.zone.name === "Second Mid" && second.zone.name === "Top Mid" && secondShare >= 0.18) {
    return {
      label: "Top Mid",
      zoneLabel: "Second Mid / Top Mid",
      occupancyShare: top.share,
    };
  }

  if ((has("Second Mid") || has("Top Mid")) && has("Apartments") && pairShare >= 0.82 && secondShare >= 0.12) {
    return {
      label: "Apartments / Mid",
      zoneLabel: has("Second Mid") ? "Second Mid / Apartments" : "Top Mid / Apartments",
      occupancyShare: top.share,
    };
  }

  if ((has("Second Mid") || has("Top Mid")) && has("Boiler") && pairShare >= 0.9) {
    return {
      label: "Boiler / Mid",
      zoneLabel: has("Second Mid") ? "Second Mid / Boiler" : "Top Mid / Boiler",
      occupancyShare: top.share,
    };
  }

  if ((has("Second Mid") || has("Top Mid")) && has("Short") && secondShare >= 0.12) {
    return {
      label: "Mid / Short",
      zoneLabel: has("Second Mid") ? "Second Mid / Short" : "Top Mid / Short",
      occupancyShare: top.share,
    };
  }

  if ((has("Second Mid") || has("Top Mid")) && (has("Arch") || has("Library")) && secondShare >= 0.12) {
    return {
      label: "Mid / Arch",
      zoneLabel: has("Second Mid")
        ? `Second Mid / ${has("Arch") ? "Arch" : "Library"}`
        : `Top Mid / ${has("Arch") ? "Arch" : "Library"}`,
      occupancyShare: top.share,
    };
  }

  if (has("Top Mid") && has("Short") && secondShare >= 0.14) {
    return {
      label: "Short",
      zoneLabel: "Top Mid / Short",
      occupancyShare: top.share,
    };
  }

  if ((has("Second Mid") || has("Top Mid")) && has("A Site / Pit") && secondShare >= 0.12) {
    return {
      label: "Mid / A",
      zoneLabel: has("Second Mid") ? "Second Mid / A Site" : "Top Mid / A Site",
      occupancyShare: top.share,
    };
  }

  if (has("Arch") && has("Library")) {
    return {
      label: "Arch / Library",
      zoneLabel: "Arch / Library",
      occupancyShare: top.share,
    };
  }

  if ((has("Arch") || has("Library")) && has("A Site / Pit")) {
    return {
      label: "Arch Wrap",
      zoneLabel: `${has("Arch") ? "Arch" : "Library"} / A Site`,
      occupancyShare: top.share,
    };
  }

  return null;
}

export function inspectSideZoneShares(replayMap: Replay["map"], tally: SideZoneTallies[Side]): SideZoneShare[] {
  const mapZones = MAP_ZONES[replayMap.mapId];
  if (!mapZones || tally.totalSamples <= 0) {
    return [];
  }

  return Array.from(tally.byName.entries())
    .map(([zoneName, samples]) => {
      const zone = mapZones.find((entry) => entry.name === zoneName);
      if (!zone) {
        return null;
      }

      return {
        zoneName,
        ctLabel: zone.ctLabel,
        tLabel: zone.tLabel,
        samples,
        share: samples / tally.totalSamples,
      };
    })
    .filter((entry): entry is SideZoneShare => entry != null)
    .sort((left, right) => right.samples - left.samples);
}

function preferCtPrimary(
  top: { zone: ZoneDefinition; samples: number; share: number },
  ranked: Array<{ zone: ZoneDefinition; samples: number; share: number }>,
) {
  const topLabel = top.zone.ctLabel;
  if (!(topLabel === "Rotation" || topLabel === "Mid Rotation")) {
    return null;
  }

  const topSpecificity = getCtSpecificity(topLabel);
  const candidates = ranked
    .filter(
      (entry) =>
        entry.zone.name !== top.zone.name &&
        getCtSpecificity(entry.zone.ctLabel) > topSpecificity &&
        entry.share >= 0.2 &&
        top.share - entry.share <= PREFERRED_PRIMARY_DELTA,
    )
    .sort((left, right) => {
      const specificityDelta = getCtSpecificity(right.zone.ctLabel) - getCtSpecificity(left.zone.ctLabel);
      return specificityDelta !== 0 ? specificityDelta : right.share - left.share;
    });

  return candidates[0] ?? null;
}

function preferTPrimary(
  top: { zone: ZoneDefinition; samples: number; share: number },
  ranked: Array<{ zone: ZoneDefinition; samples: number; share: number }>,
) {
  const topSpecificity = getTSpecificity(top.zone, top.zone.tLabel);
  if (topSpecificity >= 3) {
    return null;
  }

  const candidates = ranked
    .filter(
      (entry) =>
        entry.zone.name !== top.zone.name &&
        getTSpecificity(entry.zone, entry.zone.tLabel) > topSpecificity &&
        entry.share >= 0.18 &&
        top.share - entry.share <= PREFERRED_PRIMARY_DELTA,
    )
    .sort((left, right) => {
      const specificityDelta = getTSpecificity(right.zone, right.zone.tLabel) - getTSpecificity(left.zone, left.zone.tLabel);
      return specificityDelta !== 0 ? specificityDelta : right.share - left.share;
    });

  return candidates[0] ?? null;
}

function classifyZone(replayMap: Replay["map"], worldX: number, worldY: number) {
  const mapZones = MAP_ZONES[replayMap.mapId];
  if (!mapZones) {
    return null;
  }

  const { worldXMin, worldXMax, worldYMin, worldYMax } = replayMap.coordinateSystem;
  const xRatio = (worldX - worldXMin) / Math.max(1, worldXMax - worldXMin);
  const yRatio = 1 - (worldY - worldYMin) / Math.max(1, worldYMax - worldYMin);

  return (
    mapZones.find((zone) =>
      zone.rects.some((rect) => xRatio >= rect.xMin && xRatio <= rect.xMax && yRatio >= rect.yMin && yRatio <= rect.yMax),
    ) ?? null
  );
}

function combineCtLabels(first: ZoneDefinition, second: ZoneDefinition) {
  if (first.ctLabel === second.ctLabel) {
    return first.ctLabel;
  }

  const labels = [first.ctLabel, second.ctLabel];
  const names = [first.name, second.name];
  const hasAnchor = labels.some((label) => label.includes("Anchor"));
  const hasRotation = labels.some((label) => label.includes("Rotation"));
  const hasAZone = labels.some((label) => label.startsWith("A "));
  const hasBZone = labels.some((label) => label.startsWith("B "));

  if (hasAnchor && hasRotation && hasAZone && !hasBZone) {
    return "A Rotation";
  }

  if (hasAnchor && hasRotation && hasBZone && !hasAZone) {
    return "B Rotation";
  }

  if (names.includes("Mid") || names.includes("Top Mid") || names.includes("Connector / Mid")) {
    return "Mid Rotation";
  }

  if (hasAnchor && labels.every((label) => label.includes("Anchor"))) {
    return "Allround";
  }

  return first.ctLabel;
}

function combineTLabels(first: ZoneDefinition, second: ZoneDefinition) {
  if (first.tLabel === second.tLabel) {
    return first.tLabel;
  }

  const labels = [first.tLabel, second.tLabel];
  const names = [first.name, second.name];

  if (names.includes("Boiler") && names.includes("Top Mid")) {
    return "Boiler / Mid";
  }

  if (names.includes("Second Mid") && names.includes("Top Mid")) {
    return "Mid";
  }

  if (names.includes("Top Mid") && names.includes("Arch / Library")) {
    return "Mid";
  }

  if (names.includes("Second Mid") && names.includes("Boiler")) {
    return "Boiler / Mid";
  }

  if (names.includes("Second Mid") && names.includes("Arch / Library")) {
    return "Mid";
  }

  const routeFromHit = labels.find((label) => isTRouteLabel(label) && !label.endsWith("Hit"));
  if (labels.some((label) => label.endsWith("Hit")) && routeFromHit) {
    return routeFromHit;
  }

  if ((labels.includes("Mid") || labels.includes("Second Mid") || labels.includes("Top Mid") || labels.includes("Connector / Mid")) && labels.includes("Boiler")) {
    return "Boiler / Mid";
  }

  if ((labels.includes("Mid") || labels.includes("Second Mid") || labels.includes("Top Mid") || labels.includes("Connector / Mid")) && labels.includes("Cave")) {
    return "Cave / Mid";
  }

  if ((labels.includes("Mid") || labels.includes("Second Mid") || labels.includes("Top Mid") || labels.includes("Connector / Mid")) && labels.includes("Donut")) {
    return "Donut / Mid";
  }

  if ((labels.includes("Mid") || labels.includes("Second Mid") || labels.includes("Top Mid") || labels.includes("Connector / Mid")) && labels.includes("Arch / Library")) {
    return "Mid";
  }

  if (labels.includes("Mid / Connector") && (labels.includes("Mid") || labels.includes("Second Mid") || labels.includes("Top Mid"))) {
    return "Mid";
  }

  return `${first.tLabel} / ${second.tLabel}`;
}

function isCtRotationLabel(label: string) {
  return label === "Rotation" || label.includes("Rotation");
}

function isCtHoldLabel(label: string) {
  return label.includes("Anchor") || label === "Ramp Hold" || label === "Yard";
}

function getCtSpecificity(label: string) {
  if (isCtHoldLabel(label)) {
    return 3;
  }

  if (label === "Rotation") {
    return 1;
  }

  if (isCtRotationLabel(label)) {
    return 2;
  }

  return 1;
}

function isTRouteLabel(label: string) {
  return T_ROUTE_LABELS.has(label) && !label.endsWith("Hit");
}

function getTSpecificity(zone: ZoneDefinition, label: string) {
  if (label.endsWith("Hit")) {
    return 1;
  }

  if (MID_LIKE_ZONE_NAMES.has(zone.name) || label === "Mid" || label === "Connector / Mid") {
    return 2;
  }

  if (isTRouteLabel(label)) {
    return 3;
  }

  return 2;
}
