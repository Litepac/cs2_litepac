import type { ChangeEvent } from "react";
import { useEffect, useState } from "react";

import { loadReplayURL } from "../replay/loader";
import type { DemoIngestState } from "../replay/ingestState";
import { createMatchLibraryEntry, type MatchLibraryEntry, type MatchLibrarySource } from "../replay/matchLibrary";
import { deleteStoredMatch, listStoredMatches, saveStoredMatch } from "../replay/matchStore";
import { checkParserBridge, parseDemoFile } from "../replay/parserBridge";
import type { Replay } from "../replay/types";

export function useReplayLoader() {
  const [error, setError] = useState<string | null>(null);
  const [demoIngestState, setDemoIngestState] = useState<DemoIngestState | null>(null);
  const [libraryHydrated, setLibraryHydrated] = useState(false);
  const [libraryEntries, setLibraryEntries] = useState<MatchLibraryEntry[]>([]);
  const [loadingSource, setLoadingSource] = useState<"demo" | "fixture" | "replay" | null>(null);
  const [parserBridgeAvailable, setParserBridgeAvailable] = useState(false);
  const [roundIndex, setRoundIndex] = useState(0);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [activeReplayId, setActiveReplayId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function refreshParserBridge() {
      const available = await checkParserBridge();
      if (!cancelled) {
        setParserBridgeAvailable(available);
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
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function hydrateLibrary() {
      try {
        const storedMatches = await listStoredMatches();
        if (!cancelled) {
          setLibraryEntries(storedMatches);
        }
      } catch (storageError) {
        if (!cancelled) {
          setError(storageError instanceof Error ? storageError.message : String(storageError));
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
  }, []);

  const replay = libraryEntries.find((entry) => entry.id === activeReplayId)?.replay ?? null;

  async function onDemoFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

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
        onProgress: ({ roundsParsed }) => {
          setDemoIngestState((previous) =>
            previous == null
              ? null
              : {
                  ...previous,
                  roundsIndexed: roundsParsed,
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
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
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
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoadingSource(null);
    }
  }

  function openReplay(id: string) {
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
    } catch (deleteError) {
      setLibraryEntries(previousEntries);
      if (deletingActiveReplay) {
        setActiveReplayId(id);
      }
      setError(deleteError instanceof Error ? deleteError.message : String(deleteError));
    }
  }

  async function ingestReplay(loaded: Replay, source: MatchLibrarySource, options: { openViewer: boolean; persist: boolean }) {
    const entry = createMatchLibraryEntry(loaded, source);

    setLibraryEntries((previous) => {
      const existingIndex = previous.findIndex((candidate) => candidate.id === entry.id);
      if (existingIndex === -1) {
        return [entry, ...previous];
      }

      const next = previous.slice();
      const existing = next[existingIndex];
      next.splice(existingIndex, 1);
      next.unshift({
        ...existing,
        replay: loaded,
        source,
        summary: entry.summary,
      });
      return next;
    });

    if (options.persist) {
      await saveStoredMatch(entry);
    }

    if (options.openViewer) {
      setActiveReplayId(entry.id);
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
