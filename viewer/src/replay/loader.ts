import { validateReplay } from "./schema";
import type { Replay } from "./types";

export async function loadReplayFile(file: File): Promise<Replay> {
  const raw = await file.text();
  const parsed = JSON.parse(raw) as unknown;
  const result = validateReplay(parsed);
  if (!result.ok) {
    throw new Error(formatReplayErrors(result.errors));
  }

  return result.replay;
}

export async function loadReplayURL(url: string): Promise<Replay> {
  const separator = url.includes("?") ? "&" : "?";
  const response = await fetch(`${url}${separator}ts=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load replay fixture: ${response.status} ${response.statusText}`);
  }

  const parsed = (await response.json()) as unknown;
  const result = validateReplay(parsed);
  if (!result.ok) {
    throw new Error(formatReplayErrors(result.errors));
  }

  return result.replay;
}

function formatReplayErrors(errors: string[]) {
  if (errors.length === 0) {
    return "Replay validation failed.";
  }

  return ["Replay validation failed:", ...errors].join("\n");
}
