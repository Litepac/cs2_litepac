import { useEffect, useMemo, useRef, useState } from "react";

import { ReplayMapFirstPage } from "../controls/ReplayMapFirstPage";
import { type HeatmapScope, type HeatmapSourceFilter, type HeatmapTeamFilter } from "../replay/heatmapAnalysis";
import {
  type PositionPlayerSnapshot,
  type PositionPlayerSelection,
  type PositionsScope,
  type PositionsSourceFilter,
  type PositionsTeamFilter,
  type PositionsView,
} from "../replay/positionsAnalysis";
import {
  type ReplayAnalysisMode,
  type UtilityAtlasEntry,
  type UtilityAtlasScope,
  type UtilityAtlasSourceFilter,
  type UtilityAtlasTeamFilter,
} from "../replay/replayAnalysis";
import { trackUsageEvent, trackUsageEventOnce } from "../replay/parserBridge";
import type { UtilityFocus } from "../replay/utilityFilter";
import { HomeShellPage, MatchesShellPage, StatsShellPage } from "./AppShellPages";
import {
  resolvePositionPlayerSelection,
  resolvePositionPlayerTeamFilter,
  resolveUtilityAtlasLiveFocus,
  toPositionPlayerRosterSelectionKey,
} from "./replayAppHelpers";
import { useFixtureCatalog } from "./useFixtureCatalog";
import { useReplayAnalysisState } from "./useReplayAnalysisState";
import { useReplayLoader } from "./useReplayLoader";
import { useReplayPlayback } from "./useReplayPlayback";
import { useTimelineMarkers } from "./useTimelineMarkers";

const MAX_POSITION_PLAYER_SELECTIONS = 3;

export function App() {
  const fixtures = useFixtureCatalog();
  const matchesUploadInputRef = useRef<HTMLInputElement | null>(null);
  const [shellPage, setShellPage] = useState<"home" | "matches" | "stats">("home");
  const {
    closeReplay,
    demoIngestState,
    deleteReplay,
    error,
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
  } = useReplayLoader(shellPage !== "home");
  const [utilityFocus, setUtilityFocus] = useState<UtilityFocus>("all");
  const [showFreezeTime, setShowFreezeTime] = useState(false);
  const [analysisMode, setAnalysisMode] = useState<ReplayAnalysisMode>("live");
  const [utilityAtlasScope, setUtilityAtlasScope] = useState<UtilityAtlasScope>("round");
  const [utilityAtlasTeamFilter, setUtilityAtlasTeamFilter] = useState<UtilityAtlasTeamFilter>("all");
  const [utilityAtlasSourceFilter, setUtilityAtlasSourceFilter] = useState<UtilityAtlasSourceFilter>("all");
  const [selectedUtilityAtlasKey, setSelectedUtilityAtlasKey] = useState<string | null>(null);
  const [positionsScope, setPositionsScope] = useState<PositionsScope>("round");
  const [positionsTeamFilter, setPositionsTeamFilter] = useState<PositionsTeamFilter>("all");
  const [positionsSourceFilter, setPositionsSourceFilter] = useState<PositionsSourceFilter>("all");
  const [positionsView, setPositionsView] = useState<PositionsView>("paths");
  const [positionPlayerSelections, setPositionPlayerSelections] = useState<PositionPlayerSelection[]>([]);
  const [positionPlayerBroadCompareEnabled, setPositionPlayerBroadCompareEnabled] = useState(false);
  const [positionPlayerCompareEnabled, setPositionPlayerCompareEnabled] = useState(false);
  const [showPositionRoundNumbers, setShowPositionRoundNumbers] = useState(false);
  const [heatmapScope, setHeatmapScope] = useState<HeatmapScope>("round");
  const [heatmapTeamFilter, setHeatmapTeamFilter] = useState<HeatmapTeamFilter>("all");
  const [heatmapSourceFilter, setHeatmapSourceFilter] = useState<HeatmapSourceFilter>("all");
  const [livePlayerContextMode, setLivePlayerContextMode] = useState(false);
  const [pendingUtilityJump, setPendingUtilityJump] = useState<{ roundIndex: number; tick: number } | null>(null);
  const [pendingPositionJump, setPendingPositionJump] = useState<{ roundIndex: number; tick: number } | null>(null);
  const [statsMatchId, setStatsMatchId] = useState<string | null>(null);

  const round = replay?.rounds[roundIndex] ?? null;
  const playback = useReplayPlayback(replay, round, roundIndex);
  const timelineMarkers = useTimelineMarkers(replay, round, utilityFocus);
  const statsEntry = statsMatchId ? libraryEntries.find((entry) => entry.id === statsMatchId) ?? null : null;
  const selectedPlayerName = replay?.players.find((player) => player.playerId === selectedPlayerId)?.displayName ?? null;
  const positionPlayerSelectedKeys = useMemo(
    () => positionPlayerSelections.map((player) => toPositionPlayerRosterSelectionKey(player.playerIds, player.side)),
    [positionPlayerSelections],
  );
  const {
    displayedPositionTrailEntries,
    heatmapSnapshot,
    positionPlayerSnapshots,
    utilityAtlasEntries,
  } = useReplayAnalysisState({
    heatmapScope,
    heatmapSourceFilter,
    heatmapTeamFilter,
    playbackInitialRoundTick: playback.initialRoundTick,
    playbackRenderTick: playback.renderTick,
    positionPlayerBroadCompareEnabled,
    positionPlayerSelections,
    positionsScope,
    positionsSourceFilter,
    positionsTeamFilter,
    positionsView,
    replay,
    round,
    roundIndex,
    selectedPlayerId,
    showFreezeTime,
    utilityAtlasScope,
    utilityAtlasSourceFilter,
    utilityAtlasTeamFilter,
    utilityFocus,
  });
  const feedbackContext = useMemo(
    () => ({
      analysisMode: replay ? analysisMode : null,
      matchId: replay?.sourceDemo.sha256 ?? statsMatchId ?? null,
      mapName: replay?.map.displayName ?? statsEntry?.summary.mapName ?? null,
      replayRoundNumber: round?.roundNumber ?? null,
      shellPage: replay ? "replay" : shellPage,
    }),
    [analysisMode, replay, round?.roundNumber, shellPage, statsEntry?.summary.mapName, statsMatchId],
  );

  useEffect(() => {
    trackUsageEventOnce("app_opened", `${window.location.pathname}:${shellPage}`, {
      shellPage,
    });
  }, []);

  useEffect(() => {
    if (selectedPlayerId == null && utilityAtlasSourceFilter === "selected") {
      setUtilityAtlasSourceFilter("all");
    }
    if (selectedPlayerId == null && positionsSourceFilter === "selected") {
      setPositionsSourceFilter("all");
      setPositionPlayerSelections([]);
      setPositionPlayerBroadCompareEnabled(false);
      setPositionPlayerCompareEnabled(false);
    }
    if (selectedPlayerId == null && heatmapSourceFilter === "selected") {
      setHeatmapSourceFilter("all");
    }
  }, [heatmapSourceFilter, positionsSourceFilter, selectedPlayerId, utilityAtlasSourceFilter]);

  useEffect(() => {
    if (!replay) {
      return;
    }

    setAnalysisMode("live");
    setUtilityFocus("all");
    setShowFreezeTime(false);
    setUtilityAtlasScope("round");
    setUtilityAtlasTeamFilter("all");
    setUtilityAtlasSourceFilter("all");
    setSelectedUtilityAtlasKey(null);
    setPositionsScope("round");
    setPositionsTeamFilter("all");
    setPositionsSourceFilter("all");
    setPositionsView("paths");
    setPositionPlayerSelections([]);
    setPositionPlayerBroadCompareEnabled(false);
    setPositionPlayerCompareEnabled(false);
    setShowPositionRoundNumbers(false);
    setHeatmapScope("round");
    setHeatmapTeamFilter("all");
    setHeatmapSourceFilter("all");
    setLivePlayerContextMode(false);
    setPendingUtilityJump(null);
    setPendingPositionJump(null);
  }, [replay?.sourceDemo.sha256]);

  useEffect(() => {
    if (analysisMode !== "utilityAtlas") {
      setSelectedUtilityAtlasKey(null);
      return;
    }

    if (selectedUtilityAtlasKey && !utilityAtlasEntries.some((entry) => entry.key === selectedUtilityAtlasKey)) {
      setSelectedUtilityAtlasKey(null);
    }
  }, [analysisMode, selectedUtilityAtlasKey, utilityAtlasEntries]);

  useEffect(() => {
    if (!pendingUtilityJump || !replay || !round || pendingUtilityJump.roundIndex !== roundIndex) {
      return;
    }

    playback.changeTick(pendingUtilityJump.tick);
    setPendingUtilityJump(null);
  }, [pendingUtilityJump, playback, replay, round, roundIndex]);

  useEffect(() => {
    if (!pendingPositionJump || !replay || !round || pendingPositionJump.roundIndex !== roundIndex) {
      return;
    }

    playback.changeTick(pendingPositionJump.tick);
    setPendingPositionJump(null);
  }, [pendingPositionJump, playback, replay, round, roundIndex]);

  async function handleDemoFileChange(event: Parameters<typeof onDemoFileChange>[0]) {
    await onDemoFileChange(event);
    setShellPage("matches");
  }

  function handleOpenMatch(id: string) {
    openReplay(id);
    setShellPage("matches");
  }

  function handleOpenStats(id: string) {
    const entry = libraryEntries.find((candidate) => candidate.id === id);
    trackUsageEvent("stats_opened", {
      mapName: entry?.summary.mapName ?? null,
      matchId: id,
      source: entry?.source ?? null,
      teamAName: entry?.summary.teamAName ?? null,
      teamBName: entry?.summary.teamBName ?? null,
    });
    setStatsMatchId(id);
    setShellPage("stats");
  }

  function handleAnalysisModeChange(mode: ReplayAnalysisMode) {
    if (analysisMode === mode) {
      return;
    }

    if (analysisMode === "positions" && mode !== "positions") {
      // Manual mode switches should not preserve hidden Position Player compare state.
      setPositionPlayerSelections([]);
      setPositionPlayerBroadCompareEnabled(false);
      setPositionPlayerCompareEnabled(false);
      setPositionsSourceFilter("all");
      setPositionsTeamFilter("all");
    }

    setAnalysisMode(mode);
    setLivePlayerContextMode(false);
  }

  function updatePositionPlayerSelections(nextSelections: PositionPlayerSelection[], focusedPlayerId?: string | null) {
    const normalizedSelections = nextSelections.slice(0, MAX_POSITION_PLAYER_SELECTIONS);
    const selectedPlayerIds = new Set(normalizedSelections.flatMap((selection) => selection.playerIds));
    // Compare mode can render multiple ghosts, but live replay focus still tracks one explicit player.
    const nextSelectedPlayerId =
      focusedPlayerId && selectedPlayerIds.has(focusedPlayerId)
        ? focusedPlayerId
        : selectedPlayerId && selectedPlayerIds.has(selectedPlayerId)
          ? selectedPlayerId
          : normalizedSelections[0]?.playerIds[0] ?? null;

    setPositionPlayerSelections(normalizedSelections);
    setPositionPlayerBroadCompareEnabled(false);
    if (normalizedSelections.length === 0) {
      setPositionPlayerCompareEnabled(false);
    }
    setSelectedPlayerId(nextSelectedPlayerId);
    setPositionsSourceFilter(normalizedSelections.length > 0 ? "selected" : "all");
    setPositionsTeamFilter((currentTeamFilter) => resolvePositionPlayerTeamFilter(normalizedSelections, currentTeamFilter));
  }

  function handleEnablePositionPlayerBroadCompare() {
    setLivePlayerContextMode(false);
    setPositionPlayerSelections([]);
    setPositionPlayerBroadCompareEnabled(true);
    setPositionPlayerCompareEnabled(false);
    setSelectedPlayerId(null);
    setPositionsSourceFilter("all");
    setPositionsTeamFilter("all");
  }

  function handleEnablePositionPlayerCompare() {
    if (positionsView !== "player" || positionPlayerSelections.length === 0) {
      return;
    }

    setLivePlayerContextMode(false);
    setPositionPlayerBroadCompareEnabled(false);
    setPositionPlayerCompareEnabled(true);
  }

  function handleDisablePositionPlayerCompare() {
    if (positionPlayerSelections.length > 1) {
      updatePositionPlayerSelections(positionPlayerSelections.slice(0, 1));
    }
    setPositionPlayerBroadCompareEnabled(false);
    setPositionPlayerCompareEnabled(false);
  }

  function handleReplayPlayerSelect(playerId: string) {
    const selectingLivePlayer = analysisMode === "live";
    if (!selectingLivePlayer) {
      setLivePlayerContextMode(false);
    }

    if (analysisMode === "positions" && positionsView === "player") {
      const selection = replay ? resolvePositionPlayerSelection(replay, roundIndex, playerId) : null;
      if (!selection) {
        updatePositionPlayerSelections([]);
        return;
      }

      const selectionKey = toPositionPlayerRosterSelectionKey(selection.playerIds, selection.side);
      const selectedKeys = new Set(positionPlayerSelectedKeys);

      if (positionPlayerCompareEnabled) {
        if (selectedKeys.has(selectionKey)) {
          updatePositionPlayerSelections(
            positionPlayerSelections.filter(
              (player) => toPositionPlayerRosterSelectionKey(player.playerIds, player.side) !== selectionKey,
            ),
            playerId,
          );
          return;
        }

        updatePositionPlayerSelections([...positionPlayerSelections, selection], playerId);
        return;
      }

      if (selectedKeys.has(selectionKey)) {
        updatePositionPlayerSelections([]);
        return;
      }

      updatePositionPlayerSelections([selection], playerId);
      setPositionPlayerCompareEnabled(false);
      return;
    }

    if (selectedPlayerId === playerId) {
      setSelectedPlayerId(null);
      if (selectingLivePlayer) {
        setLivePlayerContextMode(false);
      } else if (analysisMode === "utilityAtlas") {
        setUtilityAtlasSourceFilter("all");
      } else if (analysisMode === "positions") {
        setPositionsSourceFilter("all");
        setPositionsTeamFilter("all");
      } else if (analysisMode === "heatmap") {
        setHeatmapSourceFilter("all");
      }
      return;
    }

    setSelectedPlayerId(playerId);
    if (selectingLivePlayer) {
      setLivePlayerContextMode(true);
    } else if (analysisMode === "utilityAtlas") {
      setUtilityAtlasSourceFilter("selected");
      setUtilityAtlasTeamFilter("all");
    } else if (analysisMode === "positions") {
      setPositionsSourceFilter("selected");
    } else if (analysisMode === "heatmap") {
      setHeatmapSourceFilter("selected");
      setHeatmapTeamFilter("all");
    }
  }

  function handlePositionsViewChange(view: PositionsView) {
    if (analysisMode === "positions" && positionsView === view) {
      return;
    }

    setPositionsView(view);
    setLivePlayerContextMode(false);

    if (view === "player" && replay && selectedPlayerId != null) {
      const seedSelection = resolvePositionPlayerSelection(replay, roundIndex, selectedPlayerId);
      if (seedSelection) {
        updatePositionPlayerSelections([seedSelection], selectedPlayerId);
        setPositionPlayerCompareEnabled(false);
      } else {
        updatePositionPlayerSelections([]);
        setPositionPlayerBroadCompareEnabled(false);
        setPositionPlayerCompareEnabled(false);
      }
      return;
    }

    if (view === "paths") {
      setPositionPlayerSelections([]);
      setPositionPlayerBroadCompareEnabled(false);
      setPositionPlayerCompareEnabled(false);
      return;
    }

    setPositionPlayerSelections([]);
    setPositionPlayerBroadCompareEnabled(false);
    setPositionPlayerCompareEnabled(false);
  }

  function handleShowFreezeTimeChange(show: boolean) {
    setShowFreezeTime(show);
    if (!show && playback.tick < playback.initialRoundTick) {
      playback.changeTick(playback.initialRoundTick);
    }
  }

  function handleUtilityAtlasSelect(entry: UtilityAtlasEntry) {
    if (analysisMode === "utilityAtlas") {
      setSelectedUtilityAtlasKey((currentKey) => (currentKey === entry.key ? null : entry.key));
      return;
    }

    const targetRound = replay?.rounds[entry.roundIndex] ?? null;
    if (!targetRound) {
      return;
    }

    const targetTick = Math.min(
      targetRound.officialEndTick && targetRound.officialEndTick > targetRound.endTick ? targetRound.officialEndTick : targetRound.endTick,
      Math.max(targetRound.startTick, entry.jumpTick),
    );

    setAnalysisMode("live");
    setLivePlayerContextMode(Boolean(entry.throwerPlayerId));
    setUtilityFocus(resolveUtilityAtlasLiveFocus(entry.utility.kind));
    setSelectedPlayerId(entry.throwerPlayerId);
    setPendingUtilityJump({ roundIndex: entry.roundIndex, tick: targetTick });
    setRoundIndex(entry.roundIndex);
  }

  function handleSelectPositionSnapshot(snapshot: PositionPlayerSnapshot) {
    setAnalysisMode("live");
    setLivePlayerContextMode(true);
    setRoundIndex(snapshot.roundIndex);
    setSelectedPlayerId(snapshot.playerId);
    setPositionPlayerSelections(
      replay && snapshot.side ? [resolvePositionPlayerSelection(replay, snapshot.roundIndex, snapshot.playerId) ?? { playerIds: [snapshot.playerId], side: snapshot.side }] : [],
    );
    setPositionsSourceFilter("selected");
    setPendingPositionJump({ roundIndex: snapshot.roundIndex, tick: snapshot.targetTick });
  }

  return (
    <div className={replay ? "dr-replay-app" : `sky-shell sky-shell-${shellPage}`}>
      <main className={replay ? "dr-replay-app-main" : `viewer-shell viewer-shell-${shellPage}`}>
        {replay && round ? (
          <ReplayMapFirstPage
            activeRoundIndex={roundIndex}
            analysisMode={analysisMode}
            displayedPositionTrailEntries={displayedPositionTrailEntries}
            heatmapScope={heatmapScope}
            heatmapSnapshot={heatmapSnapshot}
            heatmapTeamFilter={heatmapTeamFilter}
            livePlayerContextMode={livePlayerContextMode}
            markers={timelineMarkers}
            playback={playback}
            positionPlayerBroadCompareEnabled={positionPlayerBroadCompareEnabled}
            positionPlayerCompareEnabled={positionPlayerCompareEnabled}
            positionPlayerSelectedCount={positionPlayerSelections.length}
            positionPlayerSnapshots={positionPlayerSnapshots}
            positionsScope={positionsScope}
            positionsTeamFilter={positionsTeamFilter}
            positionsView={positionsView}
            replay={replay}
            round={round}
            selectedPlayerId={selectedPlayerId}
            selectedPlayerName={selectedPlayerName}
            selectedUtilityAtlasKey={selectedUtilityAtlasKey}
            showFreezeTime={showFreezeTime}
            showPositionRoundNumbers={showPositionRoundNumbers}
            utilityAtlasEntries={utilityAtlasEntries}
            utilityAtlasScope={utilityAtlasScope}
            utilityAtlasTeamFilter={utilityAtlasTeamFilter}
            utilityFocus={utilityFocus}
            onDisablePositionPlayerCompare={handleDisablePositionPlayerCompare}
            onEnablePositionPlayerBroadCompare={handleEnablePositionPlayerBroadCompare}
            onEnablePositionPlayerCompare={handleEnablePositionPlayerCompare}
            onHeatmapTeamFilterChange={setHeatmapTeamFilter}
            onOpenHome={() => {
              closeReplay();
              setShellPage("home");
            }}
            onOpenMatches={() => {
              closeReplay();
              setShellPage("matches");
            }}
            onHeatmapScopeChange={setHeatmapScope}
            onPositionsScopeChange={setPositionsScope}
            onPositionsTeamFilterChange={setPositionsTeamFilter}
            onReplayPlayerSelect={handleReplayPlayerSelect}
            onSelectAnalysisMode={handleAnalysisModeChange}
            onSelectAtlasEntry={handleUtilityAtlasSelect}
            onSelectPositionSnapshot={handleSelectPositionSnapshot}
            onSelectPositionsView={handlePositionsViewChange}
            onSelectRound={setRoundIndex}
            onShowFreezeTimeChange={handleShowFreezeTimeChange}
            onShowPositionRoundNumbersChange={setShowPositionRoundNumbers}
            onUtilityAtlasScopeChange={setUtilityAtlasScope}
            onUtilityAtlasTeamFilterChange={setUtilityAtlasTeamFilter}
            onUtilityFocusChange={setUtilityFocus}
          />
        ) : shellPage === "home" ? (
          <HomeShellPage
            feedbackContext={feedbackContext}
            onOpenHome={() => setShellPage("home")}
            onOpenMatches={() => setShellPage("matches")}
          />
        ) : shellPage === "matches" ? (
          <MatchesShellPage
            demoIngestState={demoIngestState}
            error={error}
            feedbackContext={feedbackContext}
            fixtures={fixtures}
            libraryEntries={libraryEntries}
            libraryHydrated={libraryHydrated}
            loadingSource={loadingSource}
            matchesUploadInputRef={matchesUploadInputRef}
            parserBridgeAvailable={parserBridgeAvailable}
            parserBridgeHealth={parserBridgeHealth}
            onDemoFileChange={handleDemoFileChange}
            onDeleteMatch={deleteReplay}
            onFixtureLoad={onFixtureLoad}
            onOpenHome={() => setShellPage("home")}
            onOpenMatch={handleOpenMatch}
            onOpenMatches={() => setShellPage("matches")}
            onOpenStats={handleOpenStats}
          />
        ) : (
          <StatsShellPage
            feedbackContext={feedbackContext}
            libraryEntries={libraryEntries}
            onBackToMatches={() => setShellPage("matches")}
            onOpenHome={() => setShellPage("home")}
            onOpenMatches={() => setShellPage("matches")}
            onOpenReplay={(id) => {
              openReplay(id);
              setShellPage("stats");
            }}
            parserBridgeAvailable={parserBridgeAvailable}
            statsEntry={statsEntry}
          />
        )
        }
      </main>
    </div>
  );
}
