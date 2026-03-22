import type { UtilityKind } from "./weapons";

export type UtilityVisualKind = UtilityKind | "bomb" | "fire";

type UtilityPresentation = {
  css: string;
  pixi: number;
};

const PRESENTATION: Record<UtilityVisualKind, UtilityPresentation> = {
  bomb: { css: "#f3ae52", pixi: 0xf3ae52 },
  decoy: { css: "#cdb8ff", pixi: 0xcdb8ff },
  fire: { css: "#ffb461", pixi: 0xffb461 },
  flashbang: { css: "#fff1a3", pixi: 0xfff1a3 },
  hegrenade: { css: "#e7edf3", pixi: 0xe7edf3 },
  incendiary: { css: "#ffb461", pixi: 0xffb461 },
  molotov: { css: "#ffb461", pixi: 0xffb461 },
  smoke: { css: "#dce6ee", pixi: 0xdce6ee },
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

export function utilityColorPixi(kind: UtilityVisualKind) {
  return PRESENTATION[kind].pixi;
}
