import { useEffect, useMemo, useState } from "react";

import { ReplayStage } from "../canvas/ReplayStage";
import { HomePage } from "../controls/HomePage";
import { KillFeed } from "../controls/KillFeed";
import { MatchesPage } from "../controls/MatchesPage";
import { ReplayAnalysisPanel } from "../controls/ReplayAnalysisPanel";
import { RosterPanel } from "../controls/RosterPanel";
import { ShellTopNav } from "../controls/ShellTopNav";
import { Sidebar } from "../controls/Sidebar";
import { StatsPage } from "../controls/StatsPage";
import {
  collectHeatmapSnapshot,
  heatmapScopeLabel,
  type HeatmapScope,
  type HeatmapSourceFilter,
  type HeatmapTeamFilter,
} from "../replay/heatmapAnalysis";
import type { Side } from "../replay/derived";
import {
  collectPositionPlayerSnapshots,
  collectPositionTrailEntries,
  positionsScopeLabel,
  type PositionPlayerSnapshot,
  type PositionPlayerSelection,
  type PositionsScope,
  type PositionsSourceFilter,
  type PositionsTeamFilter,
  type PositionsView,
} from "../replay/positionsAnalysis";
import {
  buildReplaySideBlocks,
  collectUtilityAtlasEntries,
  utilityAtlasScopeLabel,
  type ReplayAnalysisMode,
  type UtilityAtlasEntry,
  type UtilityAtlasScope,
  type UtilityAtlasSourceFilter,
  type UtilityAtlasTeamFilter,
} from "../replay/replayAnalysis";
import { trackUsageEvent } from "../replay/parserBridge";
import type { UtilityFocus } from "../replay/utilityFilter";
import { TimelinePanel } from "../timeline/TimelinePanel";
import { useFixtureCatalog } from "./useFixtureCatalog";
import { useReplayLoader } from "./useReplayLoader";
import { useReplayPlayback } from "./useReplayPlayback";
import { useTimelineMarkers } from "./useTimelineMarkers";

const MAX_POSITION_PLAYER_SELECTIONS = 3;

export function App() {
  const fixtures = useFixtureCatalog();
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
    replay,
    roundIndex,
    selectedPlayerId,
    setRoundIndex,
    setSelectedPlayerId,
  } = useReplayLoader();
  const [utilityFocus, setUtilityFocus] = useState<UtilityFocus>("all");
  const [showFreezeTime, setShowFreezeTime] = useState(false);
  const [analysisMode, setAnalysisMode] = useState<ReplayAnalysisMode>("live");
  const [utilityAtlasScope, setUtilityAtlasScope] = useState<UtilityAtlasScope>("round");
  const [utilityAtlasTeamFilter, setUtilityAtlasTeamFilter] = useState<UtilityAtlasTeamFilter>("all");
  const [utilityAtlasSourceFilter, setUtilityAtlasSourceFilter] = useState<UtilityAtlasSourceFilter>("all");
  const [positionsScope, setPositionsScope] = useState<PositionsScope>("round");
  const [positionsTeamFilter, setPositionsTeamFilter] = useState<PositionsTeamFilter>("all");
  const [positionsSourceFilter, setPositionsSourceFilter] = useState<PositionsSourceFilter>("all");
  const [positionsView, setPositionsView] = useState<PositionsView>("paths");
  const [positionPlayerSelections, setPositionPlayerSelections] = useState<PositionPlayerSelection[]>([]);
  const [showPositionRoundNumbers, setShowPositionRoundNumbers] = useState(false);
  const [heatmapScope, setHeatmapScope] = useState<HeatmapScope>("round");
  const [heatmapTeamFilter, setHeatmapTeamFilter] = useState<HeatmapTeamFilter>("all");
  const [heatmapSourceFilter, setHeatmapSourceFilter] = useState<HeatmapSourceFilter>("all");
  const [livePlayerContextMode, setLivePlayerContextMode] = useState(false);
  const [pendingUtilityJump, setPendingUtilityJump] = useState<{ roundIndex: number; tick: number } | null>(null);
  const [pendingPositionJump, setPendingPositionJump] = useState<{ roundIndex: number; tick: number } | null>(null);
  const [shellPage, setShellPage] = useState<"home" | "matches" | "stats">("home");
  const [statsMatchId, setStatsMatchId] = useState<string | null>(null);

  const round = replay?.rounds[roundIndex] ?? null;
  const playback = useReplayPlayback(replay, round, roundIndex, showFreezeTime);
  const timelineMarkers = useTimelineMarkers(replay, round, utilityFocus);
  const statsEntry = statsMatchId ? libraryEntries.find((entry) => entry.id === statsMatchId) ?? null : null;
  const selectedPlayerName = replay?.players.find((player) => player.playerId === selectedPlayerId)?.displayName ?? null;
  const positionPlayerSelectedKeys = useMemo(
    () => positionPlayerSelections.map((player) => toPositionPlayerRosterSelectionKey(player.playerIds, player.side)),
    [positionPlayerSelections],
  );
  const replaySideBlocks = useMemo(() => (replay ? buildReplaySideBlocks(replay) : []), [replay]);
  const utilityAtlasEntries = useMemo(
    () =>
      replay
        ? collectUtilityAtlasEntries(replay, roundIndex, replaySideBlocks, selectedPlayerId, {
            scope: utilityAtlasScope,
            sourceFilter: utilityAtlasSourceFilter,
            teamFilter: utilityAtlasTeamFilter,
            utilityFocus,
          })
        : [],
    [replay, replaySideBlocks, roundIndex, selectedPlayerId, utilityAtlasScope, utilityAtlasSourceFilter, utilityAtlasTeamFilter, utilityFocus],
  );
  const utilityAtlasLabel = replay ? utilityAtlasScopeLabel(replay, roundIndex, replaySideBlocks, utilityAtlasScope) : "Round";
  const analysisPlayers = useMemo(() => {
    if (!replay) {
      return [];
    }

    const seen = new Set<string>();
    const streams =
      analysisMode === "positions" && positionsView === "player"
        ? replay.rounds.flatMap((entry) => entry.playerStreams)
        : (round?.playerStreams ?? []);

    return streams
      .flatMap((stream) => {
        const seenKey =
          analysisMode === "positions" && positionsView === "player"
            ? `${stream.side ?? "unknown"}:${stream.playerId}`
            : stream.playerId;

        if (stream.side == null || seen.has(seenKey)) {
          return [];
        }

        const player = replay.players.find((entry) => entry.playerId === stream.playerId);
        if (!player) {
          return [];
        }

        seen.add(seenKey);
        return [{
          displayName: player.displayName,
          playerId: player.playerId,
          side: stream.side,
          teamId: player.teamId,
          teamName: replay.teams.find((team) => team.teamId === player.teamId)?.displayName ?? player.teamId,
        }];
      })
      .sort((left, right) => {
        if (left.teamName !== right.teamName) {
          return left.teamName.localeCompare(right.teamName);
        }

        if (analysisMode === "positions" && positionsView === "player") {
          return left.displayName.localeCompare(right.displayName);
        }

        if (left.side !== right.side) {
          return left.side === "CT" ? -1 : 1;
        }

        return left.displayName.localeCompare(right.displayName);
      });
  }, [analysisMode, positionsView, replay, round]);
  const effectivePositionsScope: PositionsScope = positionsView === "player" ? "match" : positionsScope;
  const positionTrailEntries = useMemo(
    () =>
      replay
        ? collectPositionTrailEntries(replay, roundIndex, replaySideBlocks, selectedPlayerId, {
            scope: effectivePositionsScope,
            sourceFilter: positionsSourceFilter,
            teamFilter: positionsTeamFilter,
          })
        : [],
    [effectivePositionsScope, positionsSourceFilter, positionsTeamFilter, replay, replaySideBlocks, roundIndex, selectedPlayerId],
  );
  const positionsLabel = replay ? positionsScopeLabel(replay, roundIndex, replaySideBlocks, effectivePositionsScope) : "Round";
  const positionsComparisonOffsetTicks = useMemo(() => {
    if (!round) {
      return 0;
    }

    const comparisonStartTick = showFreezeTime ? round.startTick : playback.initialRoundTick;
    const visibleComparisonTick = Math.max(playback.renderTick, comparisonStartTick);
    return Math.round(visibleComparisonTick - comparisonStartTick);
  }, [playback.initialRoundTick, playback.renderTick, round, showFreezeTime]);
  const displayedPositionTrailEntries = useMemo(() => {
    if (positionsView === "player") {
      return [];
    }

    if (selectedPlayerId != null) {
      return positionTrailEntries.filter((entry) => entry.playerId === selectedPlayerId);
    }

    return positionTrailEntries;
  }, [positionTrailEntries, positionsView, selectedPlayerId]);
  const positionPlayerSnapshots = useMemo(
    () =>
      replay
        ? collectPositionPlayerSnapshots(
            replay,
            positionsView === "player" && positionsSourceFilter === "selected" ? positionPlayerSelections : [],
            positionsTeamFilter,
            positionsComparisonOffsetTicks,
            showFreezeTime,
          )
        : [],
    [positionPlayerSelections, positionsComparisonOffsetTicks, positionsSourceFilter, positionsTeamFilter, positionsView, replay, showFreezeTime],
  );
  const heatmapSnapshot = useMemo(
    () =>
      replay
        ? collectHeatmapSnapshot(replay, roundIndex, replaySideBlocks, selectedPlayerId, {
            scope: heatmapScope,
            sourceFilter: heatmapSourceFilter,
            teamFilter: heatmapTeamFilter,
          })
        : { buckets: [], cellSize: 0, maxSampleCount: 0, playerCount: 0, roundCount: 0, sampleCount: 0 },
    [heatmapScope, heatmapSourceFilter, heatmapTeamFilter, replay, replaySideBlocks, roundIndex, selectedPlayerId],
  );
  const heatmapLabel = replay ? heatmapScopeLabel(replay, roundIndex, replaySideBlocks, heatmapScope) : "Round";

  useEffect(() => {
    trackUsageEvent("app_opened", {
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
    }
    if (selectedPlayerId == null && heatmapSourceFilter === "selected") {
      setHeatmapSourceFilter("all");
    }
  }, [heatmapSourceFilter, positionsSourceFilter, selectedPlayerId, utilityAtlasSourceFilter]);

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
    setAnalysisMode(mode);
    setLivePlayerContextMode(false);
  }

  function updatePositionPlayerSelections(nextSelections: PositionPlayerSelection[]) {
    const normalizedSelections = nextSelections.slice(0, MAX_POSITION_PLAYER_SELECTIONS);
    setPositionPlayerSelections(normalizedSelections);
    setSelectedPlayerId(normalizedSelections[0]?.playerIds[0] ?? null);
    setPositionsSourceFilter(normalizedSelections.length > 0 ? "selected" : "all");
    setPositionsTeamFilter((currentTeamFilter) => resolvePositionPlayerTeamFilter(normalizedSelections, currentTeamFilter));
  }

  function handleReplayPlayerSelect(playerId: string) {
    setLivePlayerContextMode(false);
    if (selectedPlayerId === playerId) {
      setSelectedPlayerId(null);
      return;
    }

    setSelectedPlayerId(playerId);
    if (analysisMode === "utilityAtlas") {
      setUtilityAtlasSourceFilter("selected");
      setUtilityAtlasTeamFilter("all");
    } else if (analysisMode === "positions") {
      setPositionsSourceFilter("selected");
    } else if (analysisMode === "heatmap") {
      setHeatmapSourceFilter("selected");
      setHeatmapTeamFilter("all");
    }
  }

  function handleAnalysisPlayerToggle(playerIds: string[], playerSide: Side) {
    setLivePlayerContextMode(false);
    const primaryPlayerId = playerIds[0];
    if (!primaryPlayerId) {
      return;
    }

    if (analysisMode === "positions" && positionsView === "player") {
      const toggleKey = toPositionPlayerRosterSelectionKey(playerIds, playerSide);
      const selectedKeys = new Set(positionPlayerSelectedKeys);

      if (selectedKeys.has(toggleKey)) {
        updatePositionPlayerSelections(positionPlayerSelections.filter((player) => toPositionPlayerRosterSelectionKey(player.playerIds, player.side) !== toggleKey));
        return;
      }

      updatePositionPlayerSelections([...positionPlayerSelections, { playerIds, side: playerSide }]);
      return;
    }

    const selectedActive =
      analysisMode === "utilityAtlas"
        ? utilityAtlasSourceFilter === "selected" && selectedPlayerId === primaryPlayerId
        : analysisMode === "positions"
          ? positionsSourceFilter === "selected" &&
            selectedPlayerId === primaryPlayerId &&
            (positionsView !== "player" || positionsTeamFilter === "all" || positionsTeamFilter === playerSide)
          : analysisMode === "heatmap"
            ? heatmapSourceFilter === "selected" && selectedPlayerId === primaryPlayerId
          : false;

    if (selectedActive) {
      setSelectedPlayerId(null);
      if (analysisMode === "utilityAtlas") {
        setUtilityAtlasSourceFilter("all");
      } else if (analysisMode === "positions") {
        setPositionsSourceFilter("all");
        setPositionsTeamFilter("all");
      } else if (analysisMode === "heatmap") {
        setHeatmapSourceFilter("all");
      }
      return;
    }

    setSelectedPlayerId(primaryPlayerId);
    if (analysisMode === "utilityAtlas") {
      setUtilityAtlasSourceFilter("selected");
      setUtilityAtlasTeamFilter("all");
    } else if (analysisMode === "positions") {
      setPositionsSourceFilter("selected");
      if (positionsView === "player") {
        setPositionsTeamFilter(playerSide);
      }
    } else if (analysisMode === "heatmap") {
      setHeatmapSourceFilter("selected");
      setHeatmapTeamFilter("all");
    }
  }

  function handleAnalysisPlayerClear() {
    setLivePlayerContextMode(false);
    if (analysisMode === "positions" && positionsView === "player") {
      updatePositionPlayerSelections([]);
      return;
    }

    setSelectedPlayerId(null);
    if (analysisMode === "utilityAtlas") {
      setUtilityAtlasSourceFilter("all");
    } else if (analysisMode === "positions") {
      setPositionsSourceFilter("all");
      setPositionsTeamFilter("all");
    } else if (analysisMode === "heatmap") {
      setHeatmapSourceFilter("all");
    }
  }

  function handlePositionsViewChange(view: PositionsView) {
    setPositionsView(view);
    setLivePlayerContextMode(false);

    if (view === "player" && replay && selectedPlayerId != null) {
      const seedSelection = resolvePositionPlayerSelection(replay, roundIndex, selectedPlayerId);
      if (seedSelection) {
        updatePositionPlayerSelections([seedSelection]);
      } else {
        updatePositionPlayerSelections([]);
      }
      return;
    }

    if (view === "paths") {
      setPositionPlayerSelections([]);
    }
  }

  function handleUtilityAtlasSelect(entry: UtilityAtlasEntry) {
    const targetRound = replay?.rounds[entry.roundIndex] ?? null;
    if (!targetRound) {
      return;
    }

    const targetTick = Math.min(
      targetRound.officialEndTick && targetRound.officialEndTick > targetRound.endTick ? targetRound.officialEndTick : targetRound.endTick,
      Math.max(targetRound.startTick, entry.jumpTick),
    );

    if (entry.throwerPlayerId) {
      setSelectedPlayerId(entry.throwerPlayerId);
    }
    setLivePlayerContextMode(false);
    setAnalysisMode("live");
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

  const showSidebar = replay != null;

  return (
    <div className={`sky-shell ${!replay ? `sky-shell-${shellPage}` : "sky-shell-replay"}`}>
      {showSidebar ? (
        <Sidebar
          onSelectShellPage={(page) => {
            closeReplay();
            setShellPage(page);
          }}
        />
      ) : null}

      <main className={`viewer-shell ${replay ? "viewer-shell-replay" : `viewer-shell-${shellPage}`}`}>
        {replay && round ? (
          <>
            <section className="map-workspace">
              <div className="map-stage-frame">
                <ReplayAnalysisPanel
                  analysisMode={analysisMode}
                  analysisPlayers={analysisPlayers}
                  heatmapScope={heatmapScope}
                  heatmapSourceFilter={heatmapSourceFilter}
                  heatmapTeamFilter={heatmapTeamFilter}
                  positionsScope={positionsScope}
                  positionsSourceFilter={positionsSourceFilter}
                  positionsTeamFilter={positionsTeamFilter}
                  positionsView={positionsView}
                  positionPlayerMaxSelections={MAX_POSITION_PLAYER_SELECTIONS}
                  positionPlayerSelectedKeys={positionPlayerSelectedKeys}
                  showPositionRoundNumbers={showPositionRoundNumbers}
                    selectedPlayerId={selectedPlayerId}
                  selectedPlayerName={selectedPlayerName}
                  utilityAtlasScope={utilityAtlasScope}
                  utilityAtlasSourceFilter={utilityAtlasSourceFilter}
                  utilityAtlasTeamFilter={utilityAtlasTeamFilter}
                  utilityFocus={utilityFocus}
                  onSelectAnalysisMode={handleAnalysisModeChange}
                  onSelectPositionsView={handlePositionsViewChange}
                  onHeatmapScopeChange={setHeatmapScope}
                  onHeatmapTeamFilterChange={setHeatmapTeamFilter}
                  onPositionsScopeChange={setPositionsScope}
                  onPositionsTeamFilterChange={setPositionsTeamFilter}
                  onShowPositionRoundNumbersChange={setShowPositionRoundNumbers}
                  onUtilityAtlasScopeChange={setUtilityAtlasScope}
                    onUtilityAtlasTeamFilterChange={setUtilityAtlasTeamFilter}
                  onUtilityFocusChange={setUtilityFocus}
                  onAnalysisPlayerToggle={handleAnalysisPlayerToggle}
                  onAnalysisPlayerClear={handleAnalysisPlayerClear}
                />
                <ReplayStage
                  key={`${replay.sourceDemo.fileName}:${round.roundNumber}`}
                  activeRoundIndex={roundIndex}
                  analysisMode={analysisMode}
                  currentTick={playback.renderTick}
                  heatmapCellSize={heatmapSnapshot.cellSize}
                  heatmapScope={heatmapScope}
                  heatmapBuckets={heatmapSnapshot.buckets}
                  heatmapMaxSampleCount={heatmapSnapshot.maxSampleCount}
                  livePlayerContextMode={analysisMode === "live" && livePlayerContextMode}
                  onSelectAtlasEntry={handleUtilityAtlasSelect}
                  positionPlayerSnapshots={positionPlayerSnapshots}
                  positionTrailEntries={displayedPositionTrailEntries}
                  showPositionRoundNumbers={showPositionRoundNumbers}
                  positionsView={positionsView}
                  replay={replay}
                  round={round}
                  selectedPlayerId={selectedPlayerId}
                  utilityAtlasEntries={utilityAtlasEntries}
                  utilityFocus={utilityFocus}
                  onSelectPositionSnapshot={handleSelectPositionSnapshot}
                  onSelectPlayer={handleReplayPlayerSelect}
                />
                {analysisMode === "live" ? (
                  <KillFeed currentTick={playback.renderTickRounded} replay={replay} round={round} />
                ) : null}
                {analysisMode === "live" ? (
                  <aside className="right-shell right-shell-overlay">
                    <RosterPanel
                      replay={replay}
                      round={round}
                      currentTick={playback.renderTickRounded}
                      selectedPlayerId={selectedPlayerId}
                      onSelectPlayer={handleReplayPlayerSelect}
                    />
                  </aside>
                ) : null}
              </div>
            </section>

            <TimelinePanel
              activeRoundIndex={roundIndex}
              analysisMode={analysisMode}
              currentTick={playback.tick}
              heatmapLabel={heatmapLabel}
              heatmapScope={heatmapScope}
              heatmapSnapshot={heatmapSnapshot}
              initialRoundTick={playback.initialRoundTick}
              livePlayerContextMode={analysisMode === "live" && livePlayerContextMode}
              replay={replay}
              markers={timelineMarkers}
              playing={playback.playing}
              roundClock={playback.roundClock}
              round={round}
              rounds={replay.rounds}
              showFreezeTime={showFreezeTime}
              speed={playback.speed}
              tick={playback.tick}
              tickRate={replay.match.tickRate}
              positionPlayerSnapshots={positionPlayerSnapshots}
              positionPlayerSelectedCount={positionPlayerSelections.length}
              positionTrailEntries={positionTrailEntries}
              positionsLabel={positionsLabel}
              positionsTeamFilter={positionsTeamFilter}
              positionsView={positionsView}
              utilityAtlasEntries={utilityAtlasEntries}
              utilityAtlasLabel={utilityAtlasLabel}
              utilityFocus={utilityFocus}
              onSelectRound={setRoundIndex}
              onPlayToggle={playback.togglePlayback}
              onReset={playback.resetPlayback}
              onSpeedChange={playback.setSpeed}
              onShowFreezeTimeChange={setShowFreezeTime}
              onTickChange={playback.changeTick}
              onUtilityFocusChange={setUtilityFocus}
              selectedPlayerId={selectedPlayerId}
              selectedPlayerName={selectedPlayerName}
            />
          </>
        ) : shellPage === "home" ? (
            <section className="home-surface">
              <ShellTopNav
                actionLabel={libraryEntries.length > 0 ? "Open Matches" : "Start Local Review"}
                localMatchCount={libraryEntries.length}
                onAction={() => setShellPage("matches")}
                onOpenHome={() => setShellPage("home")}
                onOpenMatches={() => setShellPage("matches")}
                parserBridgeAvailable={parserBridgeAvailable}
                shellPage={shellPage}
              />
              <HomePage
                latestMatch={libraryEntries[0] ?? null}
                localMatchCount={libraryEntries.length}
                onOpenMatches={() => setShellPage("matches")}
                parserBridgeAvailable={parserBridgeAvailable}
              />
            </section>
          ) : shellPage === "matches" ? (
            <section className="matches-surface">
              <ShellTopNav
                localMatchCount={libraryEntries.length}
                onOpenHome={() => setShellPage("home")}
                onOpenMatches={() => setShellPage("matches")}
                parserBridgeAvailable={parserBridgeAvailable}
                shellPage={shellPage}
              />
              <MatchesPage
                demoIngestState={demoIngestState}
                error={error}
                fixtures={fixtures}
                libraryHydrated={libraryHydrated}
                matches={libraryEntries}
                loadingSource={loadingSource}
                parserBridgeAvailable={parserBridgeAvailable}
                onDemoFileChange={handleDemoFileChange}
                onDeleteMatch={deleteReplay}
                onFixtureLoad={onFixtureLoad}
                onOpenMatch={handleOpenMatch}
                onOpenStats={handleOpenStats}
              />
            </section>
          ) : (
            <section className="matches-surface stats-surface">
              <ShellTopNav
                localMatchCount={libraryEntries.length}
                onOpenHome={() => setShellPage("home")}
                onOpenMatches={() => setShellPage("matches")}
                parserBridgeAvailable={parserBridgeAvailable}
                shellPage={shellPage}
              />
              {statsEntry ? (
                <StatsPage
                  entry={statsEntry}
                  onBackToMatches={() => setShellPage("matches")}
                  onOpenReplay={(id) => {
                    openReplay(id);
                    setShellPage("stats");
                  }}
                />
              ) : (
                <section className="matches-page stats-page">
                  <div className="match-library-empty">This match is no longer available in your local library.</div>
                </section>
              )}
            </section>
          )
        }
      </main>
    </div>
  );
}

function resolvePositionPlayerTeamFilter(
  selections: PositionPlayerSelection[],
  currentTeamFilter: PositionsTeamFilter,
): PositionsTeamFilter {
  if (selections.length === 0) {
    return "all";
  }

  if (currentTeamFilter === "all") {
    return "all";
  }

  return selections.every((player) => player.side === currentTeamFilter) ? currentTeamFilter : "all";
}

function resolvePositionPlayerSelection(
  replay: NonNullable<ReturnType<typeof useReplayLoader>["replay"]>,
  roundIndex: number,
  playerId: string,
): PositionPlayerSelection | null {
  const activeRoundSide = replay.rounds[roundIndex]?.playerStreams.find((stream) => stream.playerId === playerId)?.side ?? null;
  const displayName = replay.players.find((player) => player.playerId === playerId)?.displayName ?? null;

  if (activeRoundSide) {
    return {
      playerIds: collectPositionPlayerIdsByNameAndSide(replay, playerId, displayName, activeRoundSide),
      side: activeRoundSide,
    };
  }

  for (const round of replay.rounds) {
    const playerSide = round.playerStreams.find((stream) => stream.playerId === playerId)?.side ?? null;
    if (playerSide) {
      return {
        playerIds: collectPositionPlayerIdsByNameAndSide(replay, playerId, displayName, playerSide),
        side: playerSide,
      };
    }
  }

  return null;
}

function collectPositionPlayerIdsByNameAndSide(
  replay: NonNullable<ReturnType<typeof useReplayLoader>["replay"]>,
  playerId: string,
  displayName: string | null,
  side: Side,
) {
  if (!displayName) {
    return [playerId];
  }

  const groupedPlayerIds = replay.players
    .filter((player) => player.displayName === displayName)
    .map((player) => player.playerId)
    .filter((candidatePlayerId) =>
      replay.rounds.some((round) =>
        round.playerStreams.some((stream) => stream.playerId === candidatePlayerId && stream.side === side),
      ),
    );

  return groupedPlayerIds.length > 0 ? groupedPlayerIds : [playerId];
}

function toPositionPlayerRosterSelectionKey(playerIds: string[], side: Side) {
  const normalizedPlayerIds = [...new Set(playerIds)].sort();
  return `${side}:${normalizedPlayerIds.join("|")}`;
}
