import type { UtilityKind } from "./weapons";

export type UtilityVisualKind = UtilityKind | "bomb" | "fire";

type UtilityPresentation = {
  css: string;
};

const PRESENTATION: Record<UtilityVisualKind, UtilityPresentation> = {
  bomb: { css: "#f3ae52" },
  decoy: { css: "#cdb8ff" },
  fire: { css: "#ffb461" },
  flashbang: { css: "#fff1a3" },
  hegrenade: { css: "#ff8a7a" },
  incendiary: { css: "#ffb461" },
  molotov: { css: "#ffb461" },
  smoke: { css: "#dce6ee" },
};

export function normalizeUtilityVisualKind(
  kind: UtilityKind | UtilityVisualKind | null | undefined,
): UtilityVisualKind | null {
  if (!kind) {
    return null;
  }

  return kind === "molotov" || kind === "incendiary" ? "fire" : kind;
}

export function utilityColorCss(kind: UtilityVisualKind) {
  return PRESENTATION[kind].css;
}
