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
