import type { UtilityEntity } from "./types";

export type UtilityFocus =
  | "all"
  | "smoke"
  | "flashbang"
  | "hegrenade"
  | "fire"
  | "decoy";

export function utilityMatchesFocus(
  kind: UtilityEntity["kind"],
  focus: UtilityFocus,
) {
  if (focus === "all") {
    return true;
  }

  if (focus === "fire") {
    return kind === "molotov" || kind === "incendiary";
  }

  return kind === focus;
}

export function utilityFocusLabel(focus: UtilityFocus) {
  switch (focus) {
    case "all":
      return "All utility";
    case "smoke":
      return "Smokes";
    case "flashbang":
      return "Flashes";
    case "hegrenade":
      return "HE";
    case "fire":
      return "Molotov / Incendiary";
    case "decoy":
      return "Decoys";
    default:
      return focus;
  }
}
