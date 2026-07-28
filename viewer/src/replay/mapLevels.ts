import type { Replay } from "./types";

export const AUTO_MAP_LEVEL = "auto";

export function resolveMapLevel(
  map: Replay["map"],
  altitude: number | null,
  requestedSectionId = AUTO_MAP_LEVEL,
) {
  const sections = map.verticalSections ?? [];
  const requested =
    requestedSectionId === AUTO_MAP_LEVEL
      ? null
      : sections.find((section) => section.sectionId === requestedSectionId) ?? null;
  const section =
    requested ??
    (altitude == null
      ? sections[0] ?? null
      : sections.find((candidate) => altitude >= candidate.altitudeMin && altitude < candidate.altitudeMax) ??
        sections[0] ??
        null);

  return {
    radarImageKey: section?.radarImageKey ?? map.radarImageKey,
    section,
  };
}
