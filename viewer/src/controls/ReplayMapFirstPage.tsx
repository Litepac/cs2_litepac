import { useEffect, useState, type PointerEvent as ReactPointerEvent } from "react";

import { ReplayStage } from "../canvas/ReplayStage";
import { scoreForSide, sideTeam } from "../replay/derived";
import type { HeatmapScope, HeatmapSnapshot, HeatmapTeamFilter } from "../replay/heatmapAnalysis";
import { livePlayersAtTick } from "../replay/live";
import type {
  PositionPlayerSnapshot,
  PositionTrailEntry,
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

const PLAYBACK_SPEEDS = [0.5, 1, 1.5, 2];

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
  livePlayerContextMode: boolean;
  markers: TimelineEventItem[];
  playback: PlaybackState;
  positionPlayerCompareEnabled: boolean;
  positionPlayerSelectedCount: number;
  positionPlayerSnapshots: PositionPlayerSnapshot[];
  positionsTeamFilter: PositionsTeamFilter;
  positionsView: PositionsView;
  replay: Replay;
  round: Round;
  selectedPlayerId: string | null;
  selectedPlayerName: string | null;
  showFreezeTime: boolean;
  showPositionRoundNumbers: boolean;
  utilityAtlasEntries: UtilityAtlasEntry[];
  utilityAtlasScope: UtilityAtlasScope;
  utilityAtlasTeamFilter: UtilityAtlasTeamFilter;
  utilityFocus: UtilityFocus;
  onDisablePositionPlayerCompare: () => void;
  onEnablePositionPlayerBroadCompare: () => void;
  onEnablePositionPlayerCompare: () => void;
  onHeatmapTeamFilterChange: (filter: HeatmapTeamFilter) => void;
  onOpenHome: () => void;
  onOpenMatches: () => void;
  onPositionsTeamFilterChange: (filter: PositionsTeamFilter) => void;
  onReplayPlayerSelect: (playerId: string) => void;
  onSelectAnalysisMode: (mode: ReplayAnalysisMode) => void;
  onSelectAtlasEntry: (entry: UtilityAtlasEntry) => void;
  onSelectPositionSnapshot: (snapshot: PositionPlayerSnapshot) => void;
  onSelectPositionsView: (view: PositionsView) => void;
  onSelectRound: (index: number) => void;
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
  livePlayerContextMode,
  markers,
  playback,
  positionPlayerCompareEnabled,
  positionPlayerSelectedCount,
  positionPlayerSnapshots,
  positionsTeamFilter,
  positionsView,
  replay,
  round,
  selectedPlayerId,
  selectedPlayerName,
  showFreezeTime,
  showPositionRoundNumbers,
  utilityAtlasEntries,
  utilityAtlasScope,
  utilityAtlasTeamFilter,
  utilityFocus,
  onDisablePositionPlayerCompare,
  onEnablePositionPlayerBroadCompare,
  onEnablePositionPlayerCompare,
  onHeatmapTeamFilterChange,
  onOpenHome,
  onOpenMatches,
  onPositionsTeamFilterChange,
  onReplayPlayerSelect,
  onSelectAnalysisMode,
  onSelectAtlasEntry,
  onSelectPositionSnapshot,
  onSelectPositionsView,
  onSelectRound,
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
  const timer = resolveRoundTimer(replay, round, playback.renderTickRounded);
  const livePlayers = livePlayersAtTick(replay, round, playback.renderTickRounded);
  const ctPlayers = livePlayers.filter((entry) => entry.side === "CT");
  const tPlayers = livePlayers.filter((entry) => entry.side === "T");
  const ctTeam = sideTeam(replay, round, "CT");
  const tTeam = sideTeam(replay, round, "T");
  const ctScore = scoreForSide(round, "CT", "before");
  const tScore = scoreForSide(round, "T", "before");

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || isInteractiveKeyboardTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === " " || event.code === "Space") {
        event.preventDefault();
        playback.togglePlayback();
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
          onSelectAtlasEntry={onSelectAtlasEntry}
          positionPlayerSnapshots={positionPlayerSnapshots}
          positionTrailEntries={displayedPositionTrailEntries}
          showPositionRoundNumbers={showPositionRoundNumbers}
          positionsView={positionsView}
          replay={replay}
          round={round}
          selectedPlayerId={selectedPlayerId}
          utilityAtlasEntries={utilityAtlasEntries}
          utilityFocus={utilityFocus}
          onSelectPositionSnapshot={onSelectPositionSnapshot}
          onSelectPlayer={onReplayPlayerSelect}
        />

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
          <div className="dr-mapfirst-transport" aria-label="Playback controls">
            <div className="dr-mapfirst-action-group" aria-label="Timeline actions">
              <button
                aria-pressed={showFreezeTime}
                className={showFreezeTime ? "dr-mapfirst-chip dr-mapfirst-chip-active" : "dr-mapfirst-chip"}
                onClick={() => onShowFreezeTimeChange(!showFreezeTime)}
                type="button"
              >
                Freeze
              </button>
              <button className="dr-mapfirst-chip" onClick={playback.resetPlayback} type="button">Reset</button>
            </div>
            <div className="dr-mapfirst-speed-group" aria-label="Playback speed">
              {PLAYBACK_SPEEDS.map((entry) => (
                <button
                  key={entry}
                  className={entry === playback.speed ? "dr-mapfirst-chip dr-mapfirst-chip-active" : "dr-mapfirst-chip"}
                  onClick={() => playback.setSpeed(entry)}
                  type="button"
                >
                  {entry}x
                </button>
              ))}
            </div>
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
          ctAlive={ctPlayers.filter((entry) => entry.alive).length}
          ctScore={ctScore}
          ctTeamName={ctTeam?.displayName ?? "CT"}
          ctTotal={ctPlayers.length}
          mapName={replay.map.displayName}
          modeLabel={resolveModeLabel(analysisMode, positionsView, livePlayerContextMode)}
          roundNumber={round.roundNumber}
          tAlive={tPlayers.filter((entry) => entry.alive).length}
          tScore={tScore}
          tTeamName={tTeam?.displayName ?? "T"}
          tTotal={tPlayers.length}
          timerDisplay={timer?.display ?? playback.roundClock ?? "--:--"}
        />

        {liveMode ? <KillFeed currentTick={playback.renderTickRounded} replay={replay} round={round} /> : null}

        <aside className="dr-mapfirst-roster-rail dr-mapfirst-roster-rail-ct" aria-label={`${ctTeam?.displayName ?? "CT"} roster`}>
          <ReplayRosterColumn
            players={ctPlayers}
            selectedPlayerId={selectedPlayerId}
            side="CT"
            teamLabel={ctTeam?.displayName ?? "CT"}
            onSelectPlayer={onReplayPlayerSelect}
          />
        </aside>
        <aside className="dr-mapfirst-roster-rail dr-mapfirst-roster-rail-t" aria-label={`${tTeam?.displayName ?? "T"} roster`}>
          <ReplayRosterColumn
            players={tPlayers}
            selectedPlayerId={selectedPlayerId}
            side="T"
            teamLabel={tTeam?.displayName ?? "T"}
            onSelectPlayer={onReplayPlayerSelect}
          />
        </aside>
      </section>

      <section className="dr-mapfirst-dock" aria-label="Replay review controls">
        <ReplayDock
          activeRoundIndex={activeRoundIndex}
          analysisMode={analysisMode}
          currentTick={playback.tick}
          displayEndTick={round.officialEndTick != null && round.officialEndTick > round.endTick ? round.officialEndTick : round.endTick}
          displayStartTick={showFreezeTime ? round.startTick : playback.initialRoundTick}
          heatmapTeamFilter={heatmapTeamFilter}
          markers={markers}
          playing={playback.playing}
          positionsTeamFilter={positionsTeamFilter}
          positionsView={positionsView}
          replay={replay}
          round={round}
          roundClock={playback.roundClock}
          selectedPlayerName={selectedPlayerName}
          tickRate={replay.match.tickRate}
          utilityAtlasScope={utilityAtlasScope}
          utilityAtlasTeamFilter={utilityAtlasTeamFilter}
          utilityFocus={utilityFocus}
          onHeatmapTeamFilterChange={onHeatmapTeamFilterChange}
          onPlayToggle={playback.togglePlayback}
          onPositionsTeamFilterChange={onPositionsTeamFilterChange}
          onSelectRound={onSelectRound}
          onTickChange={playback.changeTick}
          onUtilityAtlasScopeChange={onUtilityAtlasScopeChange}
          onUtilityAtlasTeamFilterChange={onUtilityAtlasTeamFilterChange}
          onUtilityFocusChange={onUtilityFocusChange}
        />
        {positionsView === "player" && analysisMode === "positions" ? (
          <div className="dr-mapfirst-player-tools">
            <span>{selectedPlayerName ? `Studying ${selectedPlayerName}` : "Choose a player on the map or roster"}</span>
            <button type="button" onClick={onEnablePositionPlayerBroadCompare}>Broad compare</button>
            <button type="button" disabled={positionPlayerSelectedCount === 0} onClick={onEnablePositionPlayerCompare}>Compare selected</button>
            <button type="button" disabled={!positionPlayerCompareEnabled} onClick={onDisablePositionPlayerCompare}>Focus one</button>
            <button type="button" onClick={() => onShowPositionRoundNumbersChange(!showPositionRoundNumbers)}>
              {showPositionRoundNumbers ? "Hide round numbers" : "Show round numbers"}
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
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

function resolveModeLabel(analysisMode: ReplayAnalysisMode, positionsView: PositionsView, livePlayerContextMode: boolean) {
  if (analysisMode === "live") {
    return livePlayerContextMode ? "Live focus" : "Live replay";
  }

  if (analysisMode === "utilityAtlas") {
    return "Utility";
  }

  if (analysisMode === "heatmap") {
    return "Heatmap";
  }

  return positionsView === "player" ? "Position player" : "Paths";
}
