import { useEffect, useState, type PointerEvent as ReactPointerEvent } from "react";

import { ReplayStage } from "../canvas/ReplayStage";
import type { DeathReviewEntry } from "../replay/deathReview";
import { scoreForSide, sideTeam, type Side } from "../replay/derived";
import type { HeatmapScope, HeatmapSnapshot, HeatmapTeamFilter } from "../replay/heatmapAnalysis";
import { livePlayersAtTick, type LivePlayerState } from "../replay/live";
import type {
  PositionPlayerSnapshot,
  PositionTrailEntry,
  PositionsScope,
  PositionsTeamFilter,
  PositionsView,
} from "../replay/positionsAnalysis";
import type {
  ReplayAnalysisMode,
  UtilityAtlasEntry,
  UtilityAtlasScope,
  UtilityAtlasTeamFilter,
} from "../replay/replayAnalysis";
import { resolveRoundTimer } from "../replay/roundTimer";
import type { Replay, Round } from "../replay/types";
import type { TimelineEventItem } from "../replay/timeline";
import type { UtilityFocus } from "../replay/utilityFilter";
import { KillFeed } from "./KillFeed";
import { ReplayDrawingToolbar, type StageToolMode } from "./replay-map-first/ReplayDrawingToolbar";
import { ReplayDock } from "./replay-map-first/ReplayDock";
import { ReplayHud } from "./replay-map-first/ReplayHud";
import { ReplayModeRail } from "./replay-map-first/ReplayModeRail";
import { ReplayRosterColumn } from "./replay-map-first/ReplayRosterColumn";
import "./ReplayMapFirstPage.css";

const TEAM_FILTERS: Array<{ label: string; value: "all" | Side }> = [
  { label: "All", value: "all" },
  { label: "CT", value: "CT" },
  { label: "T", value: "T" },
];
const UTILITY_OPTIONS: Array<{ label: string; value: UtilityFocus }> = [
  { label: "Smoke", value: "smoke" },
  { label: "Flash", value: "flashbang" },
  { label: "HE", value: "hegrenade" },
  { label: "Fire", value: "fire" },
  { label: "All", value: "all" },
];
const SCOPE_OPTIONS: Array<{ label: string; value: UtilityAtlasScope }> = [
  { label: "Round", value: "round" },
  { label: "Half", value: "sideBlock" },
  { label: "Match", value: "match" },
];
type RoundSetFilter = "round" | "ctSide" | "tSide" | "match";
const ROUND_SET_OPTIONS: Array<{ label: string; value: RoundSetFilter }> = [
  { label: "Round", value: "round" },
  { label: "CT side", value: "ctSide" },
  { label: "T side", value: "tSide" },
  { label: "Match", value: "match" },
];

type PlaybackState = {
  changeTick: (tick: number) => void;
  initialRoundTick: number;
  playing: boolean;
  renderTick: number;
  renderTickRounded: number;
  resetPlayback: () => void;
  roundClock: string | null;
  setSpeed: (speed: number) => void;
  speed: number;
  tick: number;
  togglePlayback: () => void;
};

type DrawingPoint = {
  x: number;
  y: number;
};

type DrawingStroke = {
  id: number;
  points: DrawingPoint[];
};

type Props = {
  activeRoundIndex: number;
  analysisMode: ReplayAnalysisMode;
  displayedPositionTrailEntries: PositionTrailEntry[];
  heatmapScope: HeatmapScope;
  heatmapSnapshot: HeatmapSnapshot;
  heatmapTeamFilter: HeatmapTeamFilter;
  deathReviewEntries: DeathReviewEntry[];
  livePlayerContextMode: boolean;
  markers: TimelineEventItem[];
  playback: PlaybackState;
  positionPlayerBroadCompareEnabled: boolean;
  positionPlayerCompareEnabled: boolean;
  positionPlayerSelectedCount: number;
  positionPlayerSnapshots: PositionPlayerSnapshot[];
  positionsScope: PositionsScope;
  positionsTeamFilter: PositionsTeamFilter;
  positionsView: PositionsView;
  replay: Replay;
  round: Round;
  selectedPlayerId: string | null;
  selectedPlayerName: string | null;
  selectedUtilityAtlasKey: string | null;
  selectedDeathReviewEntry: DeathReviewEntry | null;
  selectedDeathReviewKey: string | null;
  showFreezeTime: boolean;
  showPositionRoundNumbers: boolean;
  utilityAtlasEntries: UtilityAtlasEntry[];
  utilityAtlasScope: UtilityAtlasScope;
  utilityAtlasTeamFilter: UtilityAtlasTeamFilter;
  utilityFocus: UtilityFocus;
  onDisablePositionPlayerCompare: () => void;
  onEnablePositionPlayerBroadCompare: () => void;
  onEnablePositionPlayerCompare: () => void;
  onHeatmapScopeChange: (scope: HeatmapScope) => void;
  onHeatmapTeamFilterChange: (filter: HeatmapTeamFilter) => void;
  onOpenHome: () => void;
  onOpenMatches: () => void;
  onPositionsTeamFilterChange: (filter: PositionsTeamFilter) => void;
  onReplayPlayerSelect: (playerId: string) => void;
  onSelectAnalysisMode: (mode: ReplayAnalysisMode) => void;
  onSelectAtlasEntry: (entry: UtilityAtlasEntry) => void;
  onSelectDeathReviewEntry: (entry: DeathReviewEntry) => void;
  onSelectPositionSnapshot: (snapshot: PositionPlayerSnapshot) => void;
  onSelectPositionsView: (view: PositionsView) => void;
  onSelectRound: (index: number) => void;
  onPositionsScopeChange: (scope: PositionsScope) => void;
  onShowFreezeTimeChange: (show: boolean) => void;
  onShowPositionRoundNumbersChange: (next: boolean) => void;
  onUtilityAtlasScopeChange: (scope: UtilityAtlasScope) => void;
  onUtilityAtlasTeamFilterChange: (filter: UtilityAtlasTeamFilter) => void;
  onUtilityFocusChange: (focus: UtilityFocus) => void;
};

export function ReplayMapFirstPage({
  activeRoundIndex,
  analysisMode,
  displayedPositionTrailEntries,
  heatmapScope,
  heatmapSnapshot,
  heatmapTeamFilter,
  deathReviewEntries,
  livePlayerContextMode,
  markers,
  playback,
  positionPlayerBroadCompareEnabled,
  positionPlayerCompareEnabled,
  positionPlayerSelectedCount,
  positionPlayerSnapshots,
  positionsScope,
  positionsTeamFilter,
  positionsView,
  replay,
  round,
  selectedPlayerId,
  selectedPlayerName,
  selectedUtilityAtlasKey,
  selectedDeathReviewEntry,
  selectedDeathReviewKey,
  showFreezeTime,
  showPositionRoundNumbers,
  utilityAtlasEntries,
  utilityAtlasScope,
  utilityAtlasTeamFilter,
  utilityFocus,
  onDisablePositionPlayerCompare,
  onEnablePositionPlayerBroadCompare,
  onEnablePositionPlayerCompare,
  onHeatmapScopeChange,
  onHeatmapTeamFilterChange,
  onOpenHome,
  onOpenMatches,
  onPositionsTeamFilterChange,
  onReplayPlayerSelect,
  onSelectAnalysisMode,
  onSelectAtlasEntry,
  onSelectDeathReviewEntry,
  onSelectPositionSnapshot,
  onSelectPositionsView,
  onSelectRound,
  onPositionsScopeChange,
  onShowFreezeTimeChange,
  onShowPositionRoundNumbersChange,
  onUtilityAtlasScopeChange,
  onUtilityAtlasTeamFilterChange,
  onUtilityFocusChange,
}: Props) {
  const [stageToolMode, setStageToolMode] = useState<StageToolMode>("move");
  const [drawingStrokes, setDrawingStrokes] = useState<DrawingStroke[]>([]);
  const [activeDrawingId, setActiveDrawingId] = useState<number | null>(null);
  const liveMode = analysisMode === "live";
  const deathReviewMode = analysisMode === "deathReview";
  const timer = resolveRoundTimer(replay, round, playback.renderTickRounded);
  const livePlayers = livePlayersAtTick(replay, round, playback.renderTickRounded);
  const selectedLivePlayer = livePlayers.find((entry) => entry.playerId === selectedPlayerId) ?? null;
  const ctPlayers = livePlayers.filter((entry) => entry.side === "CT");
  const tPlayers = livePlayers.filter((entry) => entry.side === "T");
  const ctTeam = sideTeam(replay, round, "CT");
  const tTeam = sideTeam(replay, round, "T");
  const ctScore = scoreForSide(round, "CT", "before");
  const tScore = scoreForSide(round, "T", "before");

  useEffect(() => {
    setStageToolMode("move");
    setDrawingStrokes([]);
    setActiveDrawingId(null);
  }, [activeRoundIndex, replay.sourceDemo.sha256]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === " " || event.code === "Space") {
        if (!isTextEntryKeyboardTarget(event.target)) {
          event.preventDefault();
          playback.togglePlayback();
        }
        return;
      }

      if (isInteractiveKeyboardTarget(event.target)) {
        return;
      }

      if (key === "c") {
        event.preventDefault();
        setDrawingStrokes([]);
        setActiveDrawingId(null);
        return;
      }

      if (key === "d") {
        event.preventDefault();
        setStageToolMode("draw");
        return;
      }

      if (key === "m") {
        event.preventDefault();
        setStageToolMode("move");
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [playback]);

  function startDrawing(event: ReactPointerEvent<SVGSVGElement>) {
    if (stageToolMode !== "draw") {
      return;
    }

    event.preventDefault();
    const point = pointerEventToDrawingPoint(event);
    const id = Date.now();
    event.currentTarget.setPointerCapture(event.pointerId);
    setActiveDrawingId(id);
    setDrawingStrokes((strokes) => [...strokes, { id, points: [point] }]);
  }

  function continueDrawing(event: ReactPointerEvent<SVGSVGElement>) {
    if (stageToolMode !== "draw" || activeDrawingId == null) {
      return;
    }

    event.preventDefault();
    const point = pointerEventToDrawingPoint(event);
    setDrawingStrokes((strokes) =>
      strokes.map((stroke) => {
        if (stroke.id !== activeDrawingId) {
          return stroke;
        }

        const previous = stroke.points[stroke.points.length - 1];
        if (previous && Math.hypot(previous.x - point.x, previous.y - point.y) < 0.15) {
          return stroke;
        }

        return { ...stroke, points: [...stroke.points, point] };
      }),
    );
  }

  function stopDrawing(event: ReactPointerEvent<SVGSVGElement>) {
    if (activeDrawingId == null) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setActiveDrawingId(null);
  }

  const analysisControls =
    analysisMode !== "live" ? (
      <StageAnalysisControls
        analysisMode={analysisMode}
        deathReviewEntries={deathReviewEntries}
        selectedDeathReviewEntry={selectedDeathReviewEntry}
        heatmapScope={heatmapScope}
        heatmapTeamFilter={heatmapTeamFilter}
        positionPlayerBroadCompareEnabled={positionPlayerBroadCompareEnabled}
        positionPlayerCompareEnabled={positionPlayerCompareEnabled}
        positionPlayerSelectedCount={positionPlayerSelectedCount}
        positionsScope={positionsScope}
        positionsTeamFilter={positionsTeamFilter}
        positionsView={positionsView}
        selectedPlayerName={selectedPlayerName}
        showPositionRoundNumbers={showPositionRoundNumbers}
        utilityAtlasScope={utilityAtlasScope}
        utilityAtlasTeamFilter={utilityAtlasTeamFilter}
        utilityFocus={utilityFocus}
        onDisablePositionPlayerCompare={onDisablePositionPlayerCompare}
        onEnablePositionPlayerBroadCompare={onEnablePositionPlayerBroadCompare}
        onEnablePositionPlayerCompare={onEnablePositionPlayerCompare}
        onHeatmapScopeChange={onHeatmapScopeChange}
        onHeatmapTeamFilterChange={onHeatmapTeamFilterChange}
        onPositionsScopeChange={onPositionsScopeChange}
        onPositionsTeamFilterChange={onPositionsTeamFilterChange}
        onShowPositionRoundNumbersChange={onShowPositionRoundNumbersChange}
        onUtilityAtlasScopeChange={onUtilityAtlasScopeChange}
        onUtilityAtlasTeamFilterChange={onUtilityAtlasTeamFilterChange}
        onUtilityFocusChange={onUtilityFocusChange}
      />
    ) : null;

  return (
    <div className="dr-mapfirst-page">
      <ReplayModeRail
        analysisMode={analysisMode}
        onOpenHome={onOpenHome}
        onOpenMatches={onOpenMatches}
        positionsView={positionsView}
        onSelectAnalysisMode={onSelectAnalysisMode}
        onSelectPositionsView={onSelectPositionsView}
      />

      <section className="dr-mapfirst-stage" aria-label="Replay map workspace">
        <ReplayStage
          key={`${replay.sourceDemo.fileName}:${round.roundNumber}`}
          activeRoundIndex={activeRoundIndex}
          analysisMode={analysisMode}
          currentTick={playback.renderTick}
          heatmapCellSize={heatmapSnapshot.cellSize}
          heatmapScope={heatmapScope}
          heatmapBuckets={heatmapSnapshot.buckets}
          heatmapMaxSampleCount={heatmapSnapshot.maxSampleCount}
          livePlayerContextMode={liveMode && livePlayerContextMode}
          deathReviewEntries={deathReviewEntries}
          selectedDeathReviewKey={selectedDeathReviewKey}
          onSelectAtlasEntry={onSelectAtlasEntry}
          onSelectDeathReviewEntry={onSelectDeathReviewEntry}
          positionPlayerSnapshots={positionPlayerSnapshots}
          positionTrailEntries={displayedPositionTrailEntries}
          showPositionRoundNumbers={showPositionRoundNumbers}
          positionsView={positionsView}
          replay={replay}
          round={round}
          selectedPlayerId={selectedPlayerId}
          selectedUtilityAtlasKey={selectedUtilityAtlasKey}
          utilityAtlasEntries={utilityAtlasEntries}
          utilityFocus={utilityFocus}
          onSelectPositionSnapshot={onSelectPositionSnapshot}
          onSelectPlayer={onReplayPlayerSelect}
        />

        {deathReviewMode ? <div className="dr-mapfirst-death-review-inspector">{analysisControls}</div> : null}

        <div className="dr-mapfirst-stage-tool-stack">
          {deathReviewMode ? null : analysisControls}

          <div className="dr-mapfirst-stage-toolbar">
            <ReplayDrawingToolbar
              mode={stageToolMode}
              hasDrawings={drawingStrokes.length > 0}
              onClear={() => {
                setDrawingStrokes([]);
                setActiveDrawingId(null);
              }}
              onSelectDraw={() => setStageToolMode("draw")}
              onSelectMove={() => setStageToolMode("move")}
            />
          </div>
        </div>

        <svg
          aria-hidden="true"
          className={`dr-mapfirst-drawing-layer ${stageToolMode === "draw" ? "dr-mapfirst-drawing-layer-active" : ""}`}
          onPointerCancel={stopDrawing}
          onPointerDown={startDrawing}
          onPointerLeave={stopDrawing}
          onPointerMove={continueDrawing}
          onPointerUp={stopDrawing}
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
        >
          {drawingStrokes.map((stroke) => (
            <polyline
              key={stroke.id}
              className="dr-mapfirst-drawing-stroke"
              points={stroke.points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ")}
            />
          ))}
        </svg>

        <ReplayHud
          ctScore={ctScore}
          ctTeamName={ctTeam?.displayName ?? "CT"}
          mapName={replay.map.displayName}
          roundNumber={round.roundNumber}
          tScore={tScore}
          tTeamName={tTeam?.displayName ?? "T"}
          timerDisplay={timer?.display ?? playback.roundClock ?? "--:--"}
        />

        {liveMode ? <KillFeed currentTick={playback.renderTickRounded} replay={replay} round={round} /> : null}

        {liveMode && selectedPlayerId != null ? (
          <LivePlayerFocusStrip
            player={selectedLivePlayer}
            playerName={selectedPlayerName}
          />
        ) : null}

        <aside className="dr-mapfirst-roster-rail dr-mapfirst-roster-rail-ct" aria-label={`${ctTeam?.displayName ?? "CT"} roster`}>
          <ReplayRosterColumn
            activeRoundIndex={activeRoundIndex}
            currentTick={playback.renderTickRounded}
            players={ctPlayers}
            replay={replay}
            round={round}
            selectedPlayerId={selectedPlayerId}
            side="CT"
            onSelectPlayer={onReplayPlayerSelect}
          />
        </aside>
        <aside className="dr-mapfirst-roster-rail dr-mapfirst-roster-rail-t" aria-label={`${tTeam?.displayName ?? "T"} roster`}>
          <ReplayRosterColumn
            activeRoundIndex={activeRoundIndex}
            currentTick={playback.renderTickRounded}
            players={tPlayers}
            replay={replay}
            round={round}
            selectedPlayerId={selectedPlayerId}
            side="T"
            onSelectPlayer={onReplayPlayerSelect}
          />
        </aside>
      </section>

      <section className="dr-mapfirst-dock" aria-label="Replay review controls">
        <ReplayDock
          activeRoundIndex={activeRoundIndex}
          currentTick={playback.tick}
          displayEndTick={round.officialEndTick != null && round.officialEndTick > round.endTick ? round.officialEndTick : round.endTick}
          displayStartTick={showFreezeTime ? round.startTick : playback.initialRoundTick}
          markers={markers}
          playing={playback.playing}
          replay={replay}
          round={round}
          roundClock={playback.roundClock}
          showFreezeTime={showFreezeTime}
          speed={playback.speed}
          tickRate={replay.match.tickRate}
          onResetPlayback={playback.resetPlayback}
          onPlayToggle={playback.togglePlayback}
          onSelectRound={onSelectRound}
          onSetSpeed={playback.setSpeed}
          onShowFreezeTimeChange={onShowFreezeTimeChange}
          onTickChange={playback.changeTick}
        />
      </section>
    </div>
  );
}

function LivePlayerFocusStrip({
  player,
  playerName,
}: {
  player: LivePlayerState | null;
  playerName: string | null;
}) {
  const displayName = player?.name ?? playerName ?? "Selected player";
  const utilityCount = player ? countKnownUtility(player) : null;
  const weapon = player?.activeWeapon ?? player?.mainWeapon ?? null;

  return (
    <div
      className={`dr-mapfirst-live-focus-strip ${
        player?.side === "T" ? "dr-mapfirst-live-focus-strip-t" : "dr-mapfirst-live-focus-strip-ct"
      }`}
    >
      <strong>{displayName}</strong>
      {player ? (
        <>
          <span className="dr-mapfirst-live-focus-health">{player.alive ? `${player.health ?? "--"} HP` : "Dead"}</span>
          <span className="dr-mapfirst-live-focus-weapon">{weapon ?? "No weapon"}</span>
          <span className="dr-mapfirst-live-focus-util">
            {utilityCount != null ? `${utilityCount} util` : ""}
          </span>
          <span className="dr-mapfirst-live-focus-bomb">{player.hasBomb ? "C4" : ""}</span>
        </>
      ) : (
        <span className="dr-mapfirst-live-focus-empty">Outside current sample</span>
      )}
    </div>
  );
}

function StageAnalysisControls({
  analysisMode,
  deathReviewEntries,
  selectedDeathReviewEntry,
  heatmapScope,
  heatmapTeamFilter,
  positionPlayerBroadCompareEnabled,
  positionPlayerCompareEnabled,
  positionPlayerSelectedCount,
  positionsScope,
  positionsTeamFilter,
  positionsView,
  selectedPlayerName,
  showPositionRoundNumbers,
  utilityAtlasScope,
  utilityAtlasTeamFilter,
  utilityFocus,
  onDisablePositionPlayerCompare,
  onEnablePositionPlayerBroadCompare,
  onEnablePositionPlayerCompare,
  onHeatmapScopeChange,
  onHeatmapTeamFilterChange,
  onPositionsScopeChange,
  onPositionsTeamFilterChange,
  onShowPositionRoundNumbersChange,
  onUtilityAtlasScopeChange,
  onUtilityAtlasTeamFilterChange,
  onUtilityFocusChange,
}: {
  analysisMode: ReplayAnalysisMode;
  deathReviewEntries: DeathReviewEntry[];
  selectedDeathReviewEntry: DeathReviewEntry | null;
  heatmapScope: HeatmapScope;
  heatmapTeamFilter: HeatmapTeamFilter;
  positionPlayerBroadCompareEnabled: boolean;
  positionPlayerCompareEnabled: boolean;
  positionPlayerSelectedCount: number;
  positionsScope: PositionsScope;
  positionsTeamFilter: PositionsTeamFilter;
  positionsView: PositionsView;
  selectedPlayerName: string | null;
  showPositionRoundNumbers: boolean;
  utilityAtlasScope: UtilityAtlasScope;
  utilityAtlasTeamFilter: UtilityAtlasTeamFilter;
  utilityFocus: UtilityFocus;
  onDisablePositionPlayerCompare: () => void;
  onEnablePositionPlayerBroadCompare: () => void;
  onEnablePositionPlayerCompare: () => void;
  onHeatmapScopeChange: (scope: HeatmapScope) => void;
  onHeatmapTeamFilterChange: (filter: HeatmapTeamFilter) => void;
  onPositionsScopeChange: (scope: PositionsScope) => void;
  onPositionsTeamFilterChange: (filter: PositionsTeamFilter) => void;
  onShowPositionRoundNumbersChange: (next: boolean) => void;
  onUtilityAtlasScopeChange: (scope: UtilityAtlasScope) => void;
  onUtilityAtlasTeamFilterChange: (filter: UtilityAtlasTeamFilter) => void;
  onUtilityFocusChange: (focus: UtilityFocus) => void;
}) {
  const positionsRoundSet = roundSetFromScope(positionsScope, positionsTeamFilter);
  const heatmapRoundSet = roundSetFromScope(heatmapScope, heatmapTeamFilter);
  const playerSingleActive = !positionPlayerBroadCompareEnabled && !positionPlayerCompareEnabled;

  function setPositionsRoundSet(next: RoundSetFilter) {
    const { scope, teamFilter } = roundSetToScope(next);
    onPositionsScopeChange(scope);
    onPositionsTeamFilterChange(teamFilter);
  }

  function setHeatmapRoundSet(next: RoundSetFilter) {
    const { scope, teamFilter } = roundSetToScope(next);
    onHeatmapScopeChange(scope);
    onHeatmapTeamFilterChange(teamFilter);
  }

  return (
    <div
      className={`dr-mapfirst-analysis-controls dr-mapfirst-analysis-controls-${analysisMode} dr-mapfirst-analysis-controls-${analysisMode}-${positionsView}`}
      aria-label="Analysis controls"
    >
      <div className="dr-mapfirst-analysis-copy">
        <span>{resolveDockControlLabel(analysisMode, positionsView)}</span>
        {selectedPlayerName ? <strong>Focus: {selectedPlayerName}</strong> : null}
      </div>
      <div className="dr-mapfirst-analysis-actions">
        {analysisMode === "utilityAtlas" ? (
          <>
            <Segmented items={SCOPE_OPTIONS} selectedValue={utilityAtlasScope} onChange={onUtilityAtlasScopeChange} />
            <Segmented items={TEAM_FILTERS} selectedValue={utilityAtlasTeamFilter} onChange={onUtilityAtlasTeamFilterChange} />
            <Segmented items={UTILITY_OPTIONS} selectedValue={utilityFocus} onChange={onUtilityFocusChange} />
          </>
        ) : null}
        {analysisMode === "deathReview" ? (
          <DeathReviewSummary entry={selectedDeathReviewEntry} deathCount={deathReviewEntries.length} />
        ) : null}
        {analysisMode === "positions" && positionsView === "paths" ? (
          <Segmented items={ROUND_SET_OPTIONS} selectedValue={positionsRoundSet} onChange={setPositionsRoundSet} />
        ) : null}
        {analysisMode === "positions" && positionsView === "player" ? (
          <>
            <Segmented items={TEAM_FILTERS} selectedValue={positionsTeamFilter} onChange={onPositionsTeamFilterChange} />
            <div className="dr-mapfirst-analysis-player-actions">
              <button
                className={playerSingleActive ? "dr-mapfirst-analysis-action-active" : ""}
                type="button"
                aria-pressed={playerSingleActive}
                onClick={onDisablePositionPlayerCompare}
              >
                Single
              </button>
              <button
                className={positionPlayerBroadCompareEnabled ? "dr-mapfirst-analysis-action-active" : ""}
                type="button"
                aria-pressed={positionPlayerBroadCompareEnabled}
                onClick={onEnablePositionPlayerBroadCompare}
              >
                All
              </button>
              <button
                className={positionPlayerCompareEnabled ? "dr-mapfirst-analysis-action-active" : ""}
                type="button"
                aria-pressed={positionPlayerCompareEnabled}
                disabled={positionPlayerSelectedCount === 0}
                onClick={onEnablePositionPlayerCompare}
              >
                Multi
              </button>
              <button type="button" onClick={() => onShowPositionRoundNumbersChange(!showPositionRoundNumbers)}>
                {showPositionRoundNumbers ? "Hide R#" : "Show R#"}
              </button>
            </div>
          </>
        ) : null}
        {analysisMode === "heatmap" ? (
          <Segmented items={ROUND_SET_OPTIONS} selectedValue={heatmapRoundSet} onChange={setHeatmapRoundSet} />
        ) : null}
      </div>
    </div>
  );
}

function DeathReviewSummary({
  deathCount,
  entry,
}: {
  deathCount: number;
  entry: DeathReviewEntry | null;
}) {
  if (!entry) {
    return (
      <div className="dr-mapfirst-death-review-card dr-mapfirst-death-review-card-empty">
        <strong>{deathCount} deaths in round</strong>
        <span>Select a death marker on the map.</span>
      </div>
    );
  }

  return (
    <div className={`dr-mapfirst-death-review-card dr-mapfirst-death-review-card-${entry.victimSide?.toLowerCase() ?? "neutral"}`}>
      <div className="dr-mapfirst-death-review-main">
        <strong>{entry.victimName}</strong>
        <span>{entry.timeDisplay ?? "Round clock unknown"}</span>
      </div>
      <div className="dr-mapfirst-death-review-row">
        <span>Killed by</span>
        <b>{entry.killerName}</b>
      </div>
      <div className="dr-mapfirst-death-review-row">
        <span>Weapon</span>
        <b>{entry.weaponLabel}{entry.headshot ? " HS" : ""}</b>
      </div>
      <div className="dr-mapfirst-death-review-row">
        <span>5s trade</span>
        <b>{tradeStateLabel(entry)}</b>
      </div>
      <div className="dr-mapfirst-death-review-row">
        <span>Support nearby</span>
        <b>{entry.nearbyTeammates == null ? "Unknown" : `${entry.nearbyTeammates}`}</b>
      </div>
      <div className="dr-mapfirst-death-review-row">
        <span>Victim flashed</span>
        <b>{booleanFactLabel(entry.victimFlashed)}</b>
      </div>
      <div className="dr-mapfirst-death-review-row">
        <span>Killer flashed</span>
        <b>{booleanFactLabel(entry.killerFlashed)}</b>
      </div>
      <div className="dr-mapfirst-death-review-row">
        <span>Utility left</span>
        <b>{entry.victimUtilityCount == null ? "Unknown" : `${entry.victimUtilityCount}`}</b>
      </div>
      {entry.assisterName ? (
        <div className="dr-mapfirst-death-review-row">
          <span>Assist</span>
          <b>{entry.assisterName}</b>
        </div>
      ) : null}
    </div>
  );
}

type SegmentedProps<T extends string> = {
  items: Array<{ label: string; value: T }>;
  selectedValue: T;
  onChange: (value: T) => void;
};

function Segmented<T extends string>({ items, selectedValue, onChange }: SegmentedProps<T>) {
  return (
    <div className="dr-mapfirst-segmented">
      {items.map((entry) => (
        <button
          key={entry.value}
          className={entry.value === selectedValue ? "dr-mapfirst-chip dr-mapfirst-chip-active" : "dr-mapfirst-chip"}
          onClick={() => onChange(entry.value)}
          type="button"
        >
          {entry.label}
        </button>
      ))}
    </div>
  );
}

function roundSetFromScope(scope: PositionsScope | HeatmapScope, teamFilter: PositionsTeamFilter | HeatmapTeamFilter): RoundSetFilter {
  if (scope === "round") {
    return "round";
  }

  if (scope === "match" && teamFilter === "CT") {
    return "ctSide";
  }

  if (scope === "match" && teamFilter === "T") {
    return "tSide";
  }

  return "match";
}

function roundSetToScope(value: RoundSetFilter): { scope: PositionsScope; teamFilter: PositionsTeamFilter } {
  switch (value) {
    case "round":
      return { scope: "round", teamFilter: "all" };
    case "ctSide":
      return { scope: "match", teamFilter: "CT" };
    case "tSide":
      return { scope: "match", teamFilter: "T" };
    case "match":
    default:
      return { scope: "match", teamFilter: "all" };
  }
}

function countKnownUtility(player: LivePlayerState) {
  const counts = [player.flashbangs, player.smokes, player.heGrenades, player.fireGrenades, player.decoys];
  if (counts.every((entry) => entry == null)) {
    return null;
  }

  let total = 0;
  for (const count of counts) {
    total += count ?? 0;
  }
  return total;
}

function resolveDockControlLabel(analysisMode: ReplayAnalysisMode, positionsView: PositionsView) {
  if (analysisMode === "deathReview") {
    return "Death review";
  }

  if (analysisMode === "utilityAtlas") {
    return "Utility review";
  }

  if (analysisMode === "positions") {
    return positionsView === "player" ? "Player study" : "Path review";
  }

  if (analysisMode === "heatmap") {
    return "Heatmap";
  }

  return "Live review";
}

function tradeStateLabel(entry: DeathReviewEntry) {
  if (entry.tradeState === "unknown") {
    return "Unknown";
  }

  if (entry.tradeState === "traded") {
    return entry.tradeTickDelaySeconds == null ? "Traded" : `Traded ${entry.tradeTickDelaySeconds}s`;
  }

  return "Untraded";
}

function booleanFactLabel(value: boolean | null) {
  if (value == null) {
    return "Unknown";
  }

  return value ? "Yes" : "No";
}

function pointerEventToDrawingPoint(event: ReactPointerEvent<SVGSVGElement>) {
  const bounds = event.currentTarget.getBoundingClientRect();
  return {
    x: ((event.clientX - bounds.left) / Math.max(1, bounds.width)) * 100,
    y: ((event.clientY - bounds.top) / Math.max(1, bounds.height)) * 100,
  };
}

function isInteractiveKeyboardTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return (
    target.isContentEditable ||
    tagName === "button" ||
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    tagName === "a" ||
    target.closest('[role="button"], [role="slider"], input[type="range"]') != null
  );
}

function isTextEntryKeyboardTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return target.isContentEditable || tagName === "textarea" || tagName === "select" || isTextInput(target);
}

function isTextInput(target: HTMLElement) {
  if (!(target instanceof HTMLInputElement)) {
    return false;
  }

  return !["button", "checkbox", "radio", "range", "reset", "submit"].includes(target.type);
}
