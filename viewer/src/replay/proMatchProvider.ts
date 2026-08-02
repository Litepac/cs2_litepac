import { readParseStream, type DemoParseStage } from "./replayStream";
import { validateReplay } from "./schema";
import type { Replay } from "./types";

export type ProMatchCatalogEntry = {
  demoBytes: number;
  event: string;
  fileName: string;
  format: string;
  mapIndex: number;
  mapName: string;
  matchDate: string;
  matchId: string;
  matchUrl: string;
  patchVersion: string;
  roundsPlayed: number;
  rowId: string;
  score1: number;
  score2: number;
  stars: number;
  team1: string;
  team2: string;
};

export type ProMatchCatalogPage = {
  attributionUrl: string;
  entries: ProMatchCatalogEntry[];
  license: string;
  nextOffset: number;
  offset: number;
  source: string;
  total: number;
};

const parserApiBaseUrl =
  (import.meta.env.VITE_PARSER_API_BASE_URL as string | undefined)?.trim() || "";
const providerImportTimeoutMs = 30 * 60 * 1000;

function parserApiUrl(path: string) {
  return `${parserApiBaseUrl.replace(/\/+$/, "")}${path}`;
}

export async function loadProMatchCatalog(offset = 0, length = 12): Promise<ProMatchCatalogPage> {
  const params = new URLSearchParams({ length: String(length), offset: String(offset) });
  const response = await fetch(parserApiUrl(`/api/pro-matches/catalog?${params}`), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(await providerError(response, "The pro demo catalogue is unavailable."));
  }

  const payload = (await response.json()) as unknown;
  if (!isCatalogPage(payload)) {
    throw new Error("The pro demo provider returned an invalid catalogue.");
  }
  return payload;
}

export async function importProMatchDemo(
  entry: ProMatchCatalogEntry,
  options?: {
    onProgress?: (progress: { roundsParsed: number; roundsTotal?: number }) => void;
    onStage?: (stage: DemoParseStage) => void;
  },
): Promise<{ replay: Replay; replayArtifact: Blob | null }> {
  const abortController = new AbortController();
  const timeoutId = window.setTimeout(() => abortController.abort(), providerImportTimeoutMs);

  try {
    const response = await fetch(parserApiUrl("/api/pro-matches/import"), {
      body: JSON.stringify({ fileName: entry.fileName }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: abortController.signal,
    });
    if (!response.ok) {
      throw new Error(await providerError(response, "The selected pro demo could not be downloaded."));
    }

    let replayArtifact: Blob | null = null;
    const parsed = await readParseStream(response, {
      ...options,
      onArtifact: (artifact) => {
        replayArtifact = artifact;
      },
    });
    options?.onStage?.("validate");
    const result = validateReplay(parsed);
    if (!result.ok) {
      throw new Error(["Replay validation failed:", ...result.errors].join("\n"));
    }
    return { replay: result.replay, replayArtifact };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Pro demo import timed out after 30 minutes.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function isCatalogPage(value: unknown): value is ProMatchCatalogPage {
  if (value == null || typeof value !== "object") return false;
  const candidate = value as Partial<ProMatchCatalogPage>;
  return (
    typeof candidate.attributionUrl === "string" &&
    Array.isArray(candidate.entries) &&
    candidate.entries.every(isCatalogEntry) &&
    typeof candidate.license === "string" &&
    typeof candidate.nextOffset === "number" &&
    typeof candidate.offset === "number" &&
    typeof candidate.source === "string" &&
    typeof candidate.total === "number"
  );
}

function isCatalogEntry(value: unknown): value is ProMatchCatalogEntry {
  if (value == null || typeof value !== "object") return false;
  const candidate = value as Partial<ProMatchCatalogEntry>;
  return (
    typeof candidate.demoBytes === "number" && candidate.demoBytes > 0 &&
    typeof candidate.event === "string" && candidate.event.length > 0 &&
    typeof candidate.fileName === "string" && candidate.fileName.startsWith("demos/") &&
    typeof candidate.mapName === "string" &&
    typeof candidate.matchDate === "string" &&
    typeof candidate.rowId === "string" && candidate.rowId.length > 0 &&
    typeof candidate.team1 === "string" && candidate.team1.length > 0 &&
    typeof candidate.team2 === "string" && candidate.team2.length > 0
  );
}

async function providerError(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: unknown };
    if (typeof payload.error === "string" && payload.error.trim()) {
      return payload.error.trim();
    }
  } catch {
    // Preserve the product-facing fallback when the provider returns HTML.
  }
  return fallback;
}
