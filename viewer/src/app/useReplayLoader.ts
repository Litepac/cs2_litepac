import type { ChangeEvent } from "react";
import { useEffect, useState } from "react";

import { loadReplayURL } from "../replay/loader";
import type { DemoIngestState } from "../replay/ingestState";
import {
  createMatchLibraryEntry,
  createMatchLibraryFingerprint,
  type MatchLibraryEntry,
  type MatchLibrarySource,
} from "../replay/matchLibrary";
import { deleteStoredMatch, listStoredMatches, saveStoredMatch } from "../replay/matchStore";
import { getParserBridgeHealth, parseDemoFile, trackUsageEvent, type ParserBridgeHealth } from "../replay/parserBridge";
import type { Replay } from "../replay/types";

export type LoaderIssue = {
  context: "demo" | "delete" | "fixture" | "storage";
  hint?: string;
  message: string;
  title: string;
};

export function useReplayLoader(enabled = true) {
  const [error, setError] = useState<LoaderIssue | null>(null);
  const [demoIngestState, setDemoIngestState] = useState<DemoIngestState | null>(null);
  const [libraryHydrated, setLibraryHydrated] = useState(false);
  const [libraryEntries, setLibraryEntries] = useState<MatchLibraryEntry[]>([]);
  const [loadingSource, setLoadingSource] = useState<"demo" | "fixture" | "replay" | null>(null);
  const [parserBridgeAvailable, setParserBridgeAvailable] = useState(false);
  const [parserBridgeHealth, setParserBridgeHealth] = useState<ParserBridgeHealth>({ available: false });
  const [roundIndex, setRoundIndex] = useState(0);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [activeReplayId, setActiveReplayId] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;

    async function refreshParserBridge() {
      const health = await getParserBridgeHealth();
      if (!cancelled) {
        setParserBridgeHealth(health);
        setParserBridgeAvailable(health.available);
      }
    }

    void refreshParserBridge();
    const interval = window.setInterval(() => {
      void refreshParserBridge();
    }, 5000);

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        void refreshParserBridge();
      }
    }

    window.addEventListener("focus", refreshParserBridge);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshParserBridge);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;

    async function hydrateLibrary() {
      try {
        const storedMatches = await listStoredMatches();
        if (!cancelled) {
          setLibraryEntries(storedMatches);
        }
      } catch (storageError) {
        if (!cancelled) {
          setError(normalizeLoaderIssue("storage", storageError));
        }
      } finally {
        if (!cancelled) {
          setLibraryHydrated(true);
        }
      }
    }

    void hydrateLibrary();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const replay = libraryEntries.find((entry) => entry.id === activeReplayId)?.replay ?? null;

  async function onDemoFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    trackUsageEvent("demo_upload_started", {
      fileName: file.name,
      fileSizeBytes: file.size,
    });

    try {
      setError(null);
      setLoadingSource("demo");
      setDemoIngestState({
        fileName: file.name,
        mapName: null,
        roundsIndexed: 0,
        roundsTotal: null,
        step: "upload",
      });
      const loaded = await parseDemoFile(file, {
        onProgress: ({ roundsParsed, roundsTotal }) => {
          setDemoIngestState((previous) =>
            previous == null
              ? null
              : {
                  ...previous,
                  roundsIndexed: roundsParsed,
                  roundsTotal: roundsTotal ?? previous.roundsTotal,
                  step: "parser",
                },
          );
        },
        onStage: (stage) => {
          setDemoIngestState((previous) => ({
            fileName: previous?.fileName ?? file.name,
            mapName: previous?.mapName ?? null,
            roundsIndexed: previous?.roundsIndexed ?? 0,
            roundsTotal: previous?.roundsTotal ?? null,
            step: stage,
          }));
        },
      });
      setDemoIngestState({
        fileName: file.name,
        mapName: loaded.map.displayName,
        roundsIndexed: 0,
        roundsTotal: loaded.rounds.length,
        step: "index",
      });
      await animateRoundIndexing(loaded.rounds.length, (roundsIndexed) => {
        setDemoIngestState((previous) =>
          previous == null
            ? null
            : {
                ...previous,
                mapName: loaded.map.displayName,
                roundsIndexed,
                roundsTotal: loaded.rounds.length,
                step: "index",
              },
        );
      });
      setDemoIngestState({
        fileName: file.name,
        mapName: loaded.map.displayName,
        roundsIndexed: loaded.rounds.length,
        roundsTotal: loaded.rounds.length,
        step: "save",
      });
      await ingestReplay(loaded, "demo", { openViewer: false, persist: true });
      trackUsageEvent("demo_upload_succeeded", {
        fileName: file.name,
        fileSizeBytes: file.size,
        mapName: loaded.map.displayName,
        roundCount: loaded.rounds.length,
        sourceSha256: loaded.sourceDemo.sha256,
      });
      await delay(1200);
    } catch (loadError) {
      const issue = normalizeLoaderIssue("demo", loadError, parserBridgeAvailable);
      setError(issue);
      trackUsageEvent("demo_upload_failed", {
        error: issue.message,
        fileName: file.name,
        fileSizeBytes: file.size,
      });
    } finally {
      setDemoIngestState(null);
      setLoadingSource(null);
      event.target.value = "";
    }
  }

  async function onFixtureLoad(fileName: string) {
    try {
      setError(null);
      setLoadingSource("fixture");
      const loaded = await loadReplayURL(`/fixtures/${fileName}`);
      await ingestReplay(loaded, "fixture", { openViewer: true, persist: false });
      trackUsageEvent("fixture_opened", {
        fileName,
        mapName: loaded.map.displayName,
        roundCount: loaded.rounds.length,
        sourceSha256: loaded.sourceDemo.sha256,
      });
    } catch (loadError) {
      setError(normalizeLoaderIssue("fixture", loadError));
    } finally {
      setLoadingSource(null);
    }
  }

  function openReplay(id: string) {
    const entry = libraryEntries.find((candidate) => candidate.id === id);
    trackUsageEvent("replay_opened", {
      matchId: id,
      mapName: entry?.summary.mapName ?? null,
      source: entry?.source ?? null,
      teamAName: entry?.summary.teamAName ?? null,
      teamBName: entry?.summary.teamBName ?? null,
    });
    setActiveReplayId(id);
    setRoundIndex(0);
    setSelectedPlayerId(null);
    setError(null);
  }

  function closeReplay() {
    setActiveReplayId(null);
    setRoundIndex(0);
    setSelectedPlayerId(null);
  }

  async function deleteReplay(id: string) {
    const previousEntries = libraryEntries;
    const deletingActiveReplay = activeReplayId === id;

    setLibraryEntries((previous) => previous.filter((entry) => entry.id !== id));
    if (deletingActiveReplay) {
      closeReplay();
    }

    try {
      await deleteStoredMatch(id);
      setError(null);
      trackUsageEvent("match_deleted", {
        matchId: id,
      });
    } catch (deleteError) {
      setLibraryEntries(previousEntries);
      if (deletingActiveReplay) {
        setActiveReplayId(id);
      }
      setError(normalizeLoaderIssue("delete", deleteError));
    }
  }

  async function ingestReplay(loaded: Replay, source: MatchLibrarySource, options: { openViewer: boolean; persist: boolean }) {
    const fingerprint = createMatchLibraryFingerprint(loaded, source);
    const duplicates = libraryEntries.filter(
      (candidate) => createMatchLibraryFingerprint(candidate.replay, candidate.source) === fingerprint,
    );
    const existing = duplicates[0] ?? null;
    const entry = createMatchLibraryEntry(loaded, source);
    const persistedEntry =
      existing == null
        ? entry
        : {
            ...entry,
            id: existing.id,
          };

    setLibraryEntries((previous) => {
      const next = previous.filter(
        (candidate) => createMatchLibraryFingerprint(candidate.replay, candidate.source) !== fingerprint,
      );
      return [persistedEntry, ...next];
    });

    if (options.persist) {
      await saveStoredMatch(persistedEntry);
      for (const duplicate of duplicates.slice(1)) {
        await deleteStoredMatch(duplicate.id);
      }
    }

    if (options.openViewer) {
      setActiveReplayId(persistedEntry.id);
    } else {
      setActiveReplayId(null);
    }

    setRoundIndex(0);
    setSelectedPlayerId(null);
    setError(null);
  }

  return {
    activeReplayId,
    demoIngestState,
    deleteReplay,
    error,
    closeReplay,
    libraryHydrated,
    libraryEntries,
    loadingSource,
    onDemoFileChange,
    onFixtureLoad,
    openReplay,
    parserBridgeAvailable,
    parserBridgeHealth,
    replay,
    roundIndex,
    selectedPlayerId,
    setRoundIndex,
    setSelectedPlayerId,
  };
}

async function animateRoundIndexing(roundsTotal: number, onProgress: (roundsIndexed: number) => void) {
  if (roundsTotal <= 0) {
    return;
  }

  const totalDurationMs = Math.min(1200, Math.max(420, roundsTotal * 36));
  const frameDelayMs = Math.max(18, Math.round(totalDurationMs / roundsTotal));

  for (let roundsIndexed = 1; roundsIndexed <= roundsTotal; roundsIndexed += 1) {
    onProgress(roundsIndexed);
    await delay(frameDelayMs);
  }
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function normalizeLoaderIssue(
  context: "demo" | "delete" | "fixture" | "storage",
  error: unknown,
  parserBridgeAvailable?: boolean,
): LoaderIssue {
  const rawMessage = error instanceof Error ? error.message.trim() : String(error).trim();
  const normalized = rawMessage.toLowerCase();

  if (context === "demo") {
    if (!parserBridgeAvailable || normalized.includes("failed to fetch") || normalized.includes("networkerror")) {
      return {
        context,
        title: "Local parser unavailable",
        message: "The viewer could not reach the local parser API.",
        hint: "Start the local parser path and verify /api/health before uploading again.",
      };
    }

    if (normalized.includes("timed out")) {
      return {
        context,
        title: "Demo ingest timed out",
        message: rawMessage,
        hint: "The upload reached the parser, but the replay artifact was not produced in time.",
      };
    }

    if (normalized.includes("maxbuffer")) {
      return {
        context,
        title: "Fallback parser bridge could not finish",
        message: "The fallback bridge hit its parser process output limit before the replay artifact was ready.",
        hint: "Use the Go parser API path when available, or check the fallback bridge logs before retrying.",
      };
    }

    if (normalized.includes("programkontrol") || normalized.includes("application control")) {
      return {
        context,
        title: "Local parser blocked by Windows",
        message: "Windows Application Control blocked the fallback parser executable.",
        hint: "Use the Go parser API path or allow the parser binary before uploading demos again.",
      };
    }

    if (normalized.includes("fixtureparse.exe")) {
      return {
        context,
        title: "Fallback parser executable missing",
        message: rawMessage,
        hint: "Build the fallback parser binary or start the Go parser API path before uploading again.",
      };
    }

    if (normalized.includes("validation failed")) {
      return {
        context,
        title: "Canonical replay validation failed",
        message: rawMessage,
        hint: "The parser returned a replay artifact, but it did not pass viewer-side schema validation.",
      };
    }

    return {
      context,
      title: "Demo ingest failed",
      message: rawMessage || "The local parser could not turn this demo into a replay artifact.",
      hint: "Check the parser logs or try the upload again after confirming the local parser is healthy.",
    };
  }

  if (context === "fixture") {
    return {
      context,
      title: "Fixture load failed",
      message: rawMessage || "The requested fixture replay could not be loaded.",
      hint: "This only affects the validation fixtures. Uploaded local demos should still work if the parser is healthy.",
    };
  }

  if (context === "delete") {
    return {
      context,
      title: "Local delete failed",
      message: rawMessage || "The local match entry could not be deleted.",
      hint: "The library view was rolled back to preserve the stored match.",
    };
  }

  return {
    context,
    title: "Local library unavailable",
    message: rawMessage || "Browser storage could not be read.",
    hint: "The replay library uses local browser storage. Reload the page and check browser storage permissions if this persists.",
  };
}
