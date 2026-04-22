import { useEffect, useState, type PointerEvent as ReactPointerEvent } from "react";

import { ReplayStage } from "../canvas/ReplayStage";
import { scoreForSide, sideTeam, type Side } from "../replay/derived";
import type { HeatmapScope, HeatmapSnapshot, HeatmapSourceFilter, HeatmapTeamFilter } from "../replay/heatmapAnalysis";
import { livePlayersAtTick, type LivePlayerState } from "../replay/live";
import type {
  PositionPlayerSnapshot,
  PositionTrailEntry,
  PositionsScope,
  PositionsSourceFilter,
  PositionsTeamFilter,
  PositionsView,
} from "../replay/positionsAnalysis";
import type {
  ReplayAnalysisMode,
  UtilityAtlasEntry,
  UtilityAtlasScope,
  UtilityAtlasSourceFilter,
  UtilityAtlasTeamFilter,
} from "../replay/replayAnalysis";
import { resolveRoundTimer } from "../replay/roundTimer";
import type { Replay, Round } from "../replay/types";
import type { TimelineEventItem } from "../replay/timeline";
import type { UtilityFocus } from "../replay/utilityFilter";
import { normalizeUtilityVisualKind, utilityColorCss, type UtilityVisualKind } from "../replay/utilityPresentation";
import { formatWeaponLabel, resolvePlayerEquipmentState, type UtilityKind } from "../replay/weapons";
import { EquipmentIcon } from "./EquipmentIcon";
import { KillFeed } from "./KillFeed";
import { UtilityIcon } from "./UtilityIcon";
import { WeaponGlyph } from "./WeaponGlyph";
import "./ReplayMapFirstPage.css";

type AnalysisPanelPlayer = {
  displayName: string;
  playerId: string;
  side: Side;
  teamId: string;
  teamName: string;
};

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

type StageToolMode = "move" | "draw";

type Props = {
  activeRoundIndex: number;
  analysisMode: ReplayAnalysisMode;
  analysisPlayers: AnalysisPanelPlayer[];
  displayedPositionTrailEntries: PositionTrailEntry[];
  heatmapLabel: string;
  heatmapScope: HeatmapScope;
  heatmapSnapshot: HeatmapSnapshot;
  heatmapSourceFilter: HeatmapSourceFilter;
  heatmapTeamFilter: HeatmapTeamFilter;
  livePlayerContextMode: boolean;
  markers: TimelineEventItem[];
  playback: PlaybackState;
  positionPlayerBroadCompareEnabled: boolean;
  positionPlayerCompareEnabled: boolean;
  positionPlayerMaxSelections: number;
  positionPlayerSelectedCount: number;
  positionPlayerSelectedKeys: string[];
  positionPlayerSnapshots: PositionPlayerSnapshot[];
  positionTrailEntries: PositionTrailEntry[];
  positionsLabel: string;
  positionsScope: PositionsScope;
  positionsSourceFilter: PositionsSourceFilter;
  positionsTeamFilter: PositionsTeamFilter;
  positionsView: PositionsView;
  replay: Replay;
  round: Round;
  selectedPlayerId: string | null;
  selectedPlayerName: string | null;
  showFreezeTime: boolean;
  showPositionRoundNumbers: boolean;
  utilityAtlasEntries: UtilityAtlasEntry[];
  utilityAtlasLabel: string;
  utilityAtlasScope: UtilityAtlasScope;
  utilityAtlasSourceFilter: UtilityAtlasSourceFilter;
  utilityAtlasTeamFilter: UtilityAtlasTeamFilter;
  utilityFocus: UtilityFocus;
  onAnalysisPlayerClear: () => void;
  onAnalysisPlayerToggle: (playerIds: string[], playerSide: Side) => void;
  onDisablePositionPlayerCompare: () => void;
  onEnablePositionPlayerBroadCompare: () => void;
  onEnablePositionPlayerCompare: () => void;
  onHeatmapScopeChange: (scope: HeatmapScope) => void;
  onHeatmapTeamFilterChange: (filter: HeatmapTeamFilter) => void;
  onOpenHome: () => void;
  onOpenMatches: () => void;
  onPositionsScopeChange: (scope: PositionsScope) => void;
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
  analysisPlayers,
  displayedPositionTrailEntries,
  heatmapLabel,
  heatmapScope,
  heatmapSnapshot,
  heatmapSourceFilter,
  heatmapTeamFilter,
  livePlayerContextMode,
  markers,
  playback,
  positionPlayerBroadCompareEnabled,
  positionPlayerCompareEnabled,
  positionPlayerMaxSelections,
  positionPlayerSelectedCount,
  positionPlayerSelectedKeys,
  positionPlayerSnapshots,
  positionTrailEntries,
  positionsLabel,
  positionsScope,
  positionsSourceFilter,
  positionsTeamFilter,
  positionsView,
  replay,
  round,
  selectedPlayerId,
  selectedPlayerName,
  showFreezeTime,
  showPositionRoundNumbers,
  utilityAtlasEntries,
  utilityAtlasLabel,
  utilityAtlasScope,
  utilityAtlasSourceFilter,
  utilityAtlasTeamFilter,
  utilityFocus,
  onAnalysisPlayerClear,
  onAnalysisPlayerToggle,
  onDisablePositionPlayerCompare,
  onEnablePositionPlayerBroadCompare,
  onEnablePositionPlayerCompare,
  onHeatmapScopeChange,
  onHeatmapTeamFilterChange,
  onOpenHome,
  onOpenMatches,
  onPositionsScopeChange,
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
      <ModeRail
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

        <DrawingToolbar
          mode={stageToolMode}
          hasDrawings={drawingStrokes.length > 0}
          onClear={() => {
            setDrawingStrokes([]);
            setActiveDrawingId(null);
          }}
          onSelectDraw={() => setStageToolMode("draw")}
          onSelectMove={() => setStageToolMode("move")}
        />

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

        <header className="dr-mapfirst-hud" aria-label="Replay status">
          <div className="dr-mapfirst-hud-team dr-mapfirst-hud-team-ct">
            <strong>{ctTeam?.displayName ?? "CT"}</strong>
            <small>{ctPlayers.filter((entry) => entry.alive).length} / {ctPlayers.length} alive</small>
          </div>
          <div className="dr-mapfirst-hud-center">
            <span>{replay.map.displayName} / Round {round.roundNumber}</span>
            <b>{timer?.display ?? playback.roundClock ?? "--:--"}</b>
            <strong>
              <span className="dr-mapfirst-hud-score-ct">{ctScore}</span>
              <span>-</span>
              <span className="dr-mapfirst-hud-score-t">{tScore}</span>
            </strong>
            <small>{resolveModeLabel(analysisMode, positionsView, livePlayerContextMode)}</small>
          </div>
          <div className="dr-mapfirst-hud-team dr-mapfirst-hud-team-t">
            <strong>{tTeam?.displayName ?? "T"}</strong>
            <small>{tPlayers.filter((entry) => entry.alive).length} / {tPlayers.length} alive</small>
          </div>
        </header>

        {liveMode ? <KillFeed currentTick={playback.renderTickRounded} replay={replay} round={round} /> : null}

        <aside className="dr-mapfirst-roster-rail dr-mapfirst-roster-rail-ct" aria-label={`${ctTeam?.displayName ?? "CT"} roster`}>
          <RosterColumn
            players={ctPlayers}
            selectedPlayerId={selectedPlayerId}
            side="CT"
            teamLabel={ctTeam?.displayName ?? "CT"}
            onSelectPlayer={onReplayPlayerSelect}
          />
        </aside>
        <aside className="dr-mapfirst-roster-rail dr-mapfirst-roster-rail-t" aria-label={`${tTeam?.displayName ?? "T"} roster`}>
          <RosterColumn
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
          showFreezeTime={showFreezeTime}
          speed={playback.speed}
          tickRate={replay.match.tickRate}
          utilityAtlasScope={utilityAtlasScope}
          utilityAtlasTeamFilter={utilityAtlasTeamFilter}
          utilityFocus={utilityFocus}
          onHeatmapTeamFilterChange={onHeatmapTeamFilterChange}
          onPlayToggle={playback.togglePlayback}
          onPositionsTeamFilterChange={onPositionsTeamFilterChange}
          onReset={playback.resetPlayback}
          onSelectRound={onSelectRound}
          onShowFreezeTimeChange={onShowFreezeTimeChange}
          onSpeedChange={playback.setSpeed}
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

type DrawingToolbarProps = {
  hasDrawings: boolean;
  mode: StageToolMode;
  onClear: () => void;
  onSelectDraw: () => void;
  onSelectMove: () => void;
};

function DrawingToolbar({ hasDrawings, mode, onClear, onSelectDraw, onSelectMove }: DrawingToolbarProps) {
  return (
    <div className="dr-mapfirst-drawing-toolbar" aria-label="Map drawing tools">
      <button
        aria-label="Moving mode"
        className={mode === "move" ? "dr-mapfirst-tool-button dr-mapfirst-tool-button-active" : "dr-mapfirst-tool-button"}
        onClick={onSelectMove}
        title="Moving mode (M)"
        type="button"
      >
        <HandIcon />
        <kbd>M</kbd>
      </button>
      <button
        aria-label="Drawing mode"
        className={mode === "draw" ? "dr-mapfirst-tool-button dr-mapfirst-tool-button-active" : "dr-mapfirst-tool-button"}
        onClick={onSelectDraw}
        title="Drawing mode (D)"
        type="button"
      >
        <PencilIcon />
        <kbd>D</kbd>
      </button>
      <button
        aria-label="Clear drawing"
        className="dr-mapfirst-tool-button"
        disabled={!hasDrawings}
        onClick={onClear}
        title="Clear drawing (C)"
        type="button"
      >
        <ClearIcon />
        <kbd>C</kbd>
      </button>
    </div>
  );
}

function HandIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M7 11V7.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M10 11V5.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M13 11V7a1.5 1.5 0 0 1 3 0v5" />
      <path d="M16 12.5V10a1.5 1.5 0 0 1 3 0v3.5c0 4.5-2.5 7-7 7h-.8c-2.5 0-4.1-1.1-5.4-3.1L3.6 14a1.5 1.5 0 0 1 2.5-1.7L8 15" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="m4 16 9.8-9.8 4 4L8 20H4v-4Z" />
      <path d="m12.5 7.5 4 4" />
      <path d="m15 5 1.1-1.1a1.7 1.7 0 0 1 2.4 0l1.6 1.6a1.7 1.7 0 0 1 0 2.4L19 9" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M5 5 19 19" />
      <path d="M19 5 5 19" />
    </svg>
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

type ReplayDockProps = {
  activeRoundIndex: number;
  analysisMode: ReplayAnalysisMode;
  currentTick: number;
  displayEndTick: number;
  displayStartTick: number;
  heatmapTeamFilter: HeatmapTeamFilter;
  markers: TimelineEventItem[];
  playing: boolean;
  positionsTeamFilter: PositionsTeamFilter;
  positionsView: PositionsView;
  replay: Replay;
  round: Round;
  roundClock: string | null;
  selectedPlayerName: string | null;
  showFreezeTime: boolean;
  speed: number;
  tickRate: number;
  utilityAtlasScope: UtilityAtlasScope;
  utilityAtlasTeamFilter: UtilityAtlasTeamFilter;
  utilityFocus: UtilityFocus;
  onHeatmapTeamFilterChange: (filter: HeatmapTeamFilter) => void;
  onPlayToggle: () => void;
  onPositionsTeamFilterChange: (filter: PositionsTeamFilter) => void;
  onReset: () => void;
  onSelectRound: (index: number) => void;
  onShowFreezeTimeChange: (show: boolean) => void;
  onSpeedChange: (speed: number) => void;
  onTickChange: (tick: number) => void;
  onUtilityAtlasScopeChange: (scope: UtilityAtlasScope) => void;
  onUtilityAtlasTeamFilterChange: (filter: UtilityAtlasTeamFilter) => void;
  onUtilityFocusChange: (focus: UtilityFocus) => void;
};

const MODE_OPTIONS: Array<{ label: string; mode: ReplayAnalysisMode; positionsView?: PositionsView }> = [
  { label: "Live", mode: "live" },
  { label: "Utility", mode: "utilityAtlas" },
  { label: "Paths", mode: "positions", positionsView: "paths" },
  { label: "Player", mode: "positions", positionsView: "player" },
  { label: "Heatmap", mode: "heatmap" },
];

const SPEEDS = [0.5, 1, 2];
const TEAM_FILTERS: Array<{ label: string; value: "all" | Side }> = [
  { label: "All", value: "all" },
  { label: "CT", value: "CT" },
  { label: "T", value: "T" },
];
const UTILITY_OPTIONS: Array<{ label: string; value: UtilityFocus }> = [
  { label: "Smoke", value: "smoke" },
  { label: "Flash", value: "flashbang" },
  { label: "HE", value: "hegrenade" },
  { label: "Molotov", value: "fire" },
  { label: "All", value: "all" },
];
const SCOPE_OPTIONS: Array<{ label: string; value: UtilityAtlasScope }> = [
  { label: "Round", value: "round" },
  { label: "Half", value: "sideBlock" },
  { label: "Match", value: "match" },
];

type TimelineMarkerPresentation =
  | "bomb"
  | "bomb-defuse"
  | "bomb-explode"
  | "bomb-plant"
  | "decoy"
  | "fire"
  | "flash"
  | "he"
  | "kill"
  | "smoke"
  | "utility";

type PresentedTimelineMarker = {
  marker: TimelineEventItem;
  percent: number;
  presentation: TimelineMarkerPresentation;
};

type ModeRailProps = {
  analysisMode: ReplayAnalysisMode;
  onOpenHome: () => void;
  onOpenMatches: () => void;
  positionsView: PositionsView;
  onSelectAnalysisMode: (mode: ReplayAnalysisMode) => void;
  onSelectPositionsView: (view: PositionsView) => void;
};

function ModeRail({ analysisMode, onOpenHome, onOpenMatches, positionsView, onSelectAnalysisMode, onSelectPositionsView }: ModeRailProps) {
  return (
    <nav className="dr-mapfirst-mode-rail" aria-label="Replay mode">
      <div className="dr-mapfirst-mode-brand">
        <img src="/DemoRead_Logo.png" alt="DemoRead" decoding="async" />
      </div>
      <div className="dr-mapfirst-shell-rail-list" aria-label="Product navigation">
        <button className="dr-mapfirst-rail-button dr-mapfirst-shell-button" onClick={onOpenHome} type="button">
          Home
        </button>
        <button className="dr-mapfirst-rail-button dr-mapfirst-shell-button" onClick={onOpenMatches} type="button">
          Matches
        </button>
      </div>
      <div className="dr-mapfirst-mode-rail-list">
        {MODE_OPTIONS.map((entry) => {
          const active = analysisMode === entry.mode && (entry.mode !== "positions" || entry.positionsView === positionsView);
          return (
            <button
              key={`${entry.mode}-${entry.positionsView ?? "default"}`}
              className={active ? "dr-mapfirst-rail-button dr-mapfirst-rail-button-active" : "dr-mapfirst-rail-button"}
              onClick={() => {
                onSelectAnalysisMode(entry.mode);
                if (entry.positionsView) {
                  onSelectPositionsView(entry.positionsView);
                }
              }}
              type="button"
            >
              {entry.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function ReplayDock({
  activeRoundIndex,
  analysisMode,
  currentTick,
  displayEndTick,
  displayStartTick,
  heatmapTeamFilter,
  markers,
  playing,
  positionsTeamFilter,
  positionsView,
  replay,
  round,
  roundClock,
  selectedPlayerName,
  showFreezeTime,
  speed,
  tickRate,
  utilityAtlasScope,
  utilityAtlasTeamFilter,
  utilityFocus,
  onHeatmapTeamFilterChange,
  onPlayToggle,
  onPositionsTeamFilterChange,
  onReset,
  onSelectRound,
  onShowFreezeTimeChange,
  onSpeedChange,
  onTickChange,
  onUtilityAtlasScopeChange,
  onUtilityAtlasTeamFilterChange,
  onUtilityFocusChange,
}: ReplayDockProps) {
  const range = Math.max(1, displayEndTick - displayStartTick);
  const safeTick = Math.min(displayEndTick, Math.max(displayStartTick, currentTick));
  const currentPercent = ((safeTick - displayStartTick) / range) * 100;
  const visibleMarkers = markers.filter((marker) => marker.tick >= displayStartTick && marker.tick <= displayEndTick);
  const presentedMarkers = filterTimelineMarkersForDisplay(
    visibleMarkers.map((marker) => ({
      marker,
      percent: ((marker.tick - displayStartTick) / range) * 100,
      presentation: resolveTimelineMarkerPresentation(marker),
    })),
  );
  const bombPhase = resolveBombPhase(presentedMarkers);
  const elapsedSeconds = Math.max(0, (safeTick - displayStartTick) / tickRate);
  const rulerMarks = buildRulerMarks(displayStartTick, displayEndTick, tickRate);
  const showAnalysisControls = analysisMode !== "live" || selectedPlayerName != null;

  return (
    <>
      <div className="dr-mapfirst-dock-top">
        <div className="dr-mapfirst-round-strip" aria-label="Round selector">
          {replay.rounds.map((entry, index) => (
            <button
              key={entry.roundNumber}
              className={[
                "dr-mapfirst-round-button",
                index === activeRoundIndex ? "dr-mapfirst-round-button-active" : "",
                entry.winnerSide === "CT" ? "dr-mapfirst-round-button-ct" : "",
                entry.winnerSide === "T" ? "dr-mapfirst-round-button-t" : "",
              ].filter(Boolean).join(" ")}
              onClick={() => onSelectRound(index)}
              type="button"
            >
              {index + 1}
            </button>
          ))}
        </div>
      </div>

      {showAnalysisControls ? (
        <div className="dr-mapfirst-analysis-controls" aria-label="Analysis controls">
          <div className="dr-mapfirst-analysis-copy">
            <span>{resolveDockControlLabel(analysisMode, positionsView)}</span>
            <strong>{selectedPlayerName ? `Focus: ${selectedPlayerName}` : "Round context"}</strong>
          </div>
          <div className="dr-mapfirst-analysis-actions">
            {analysisMode === "utilityAtlas" ? (
              <>
                <Segmented
                  items={SCOPE_OPTIONS}
                  selectedValue={utilityAtlasScope}
                  onChange={onUtilityAtlasScopeChange}
                />
                <Segmented
                  items={TEAM_FILTERS}
                  selectedValue={utilityAtlasTeamFilter}
                  onChange={onUtilityAtlasTeamFilterChange}
                />
                <Segmented
                  items={UTILITY_OPTIONS}
                  selectedValue={utilityFocus}
                  onChange={onUtilityFocusChange}
                />
              </>
            ) : null}
            {analysisMode === "positions" ? (
              <Segmented
                items={TEAM_FILTERS}
                selectedValue={positionsTeamFilter}
                onChange={onPositionsTeamFilterChange}
              />
            ) : null}
            {analysisMode === "heatmap" ? (
              <Segmented
                items={TEAM_FILTERS}
                selectedValue={heatmapTeamFilter}
                onChange={onHeatmapTeamFilterChange}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="dr-mapfirst-timeline-row">
        <button className="dr-mapfirst-play" onClick={onPlayToggle} type="button">
          {playing ? "Pause" : "Play"}
        </button>

        <div className="dr-mapfirst-time-readout">
          <span>Round {round.roundNumber}</span>
          <strong>{roundClock ?? formatElapsed(elapsedSeconds)}</strong>
        </div>

        <div className="dr-mapfirst-track">
          <div className="dr-mapfirst-timeline-ruler" aria-hidden="true">
            {rulerMarks.map((mark) => (
              <span key={mark.key} style={{ left: `${mark.percent}%` }}>
                {mark.label}
              </span>
            ))}
          </div>
          <div className="dr-mapfirst-progress-lane">
            {bombPhase ? (
              <div
                className="dr-mapfirst-bomb-window"
                style={{ left: `${bombPhase.left}%`, width: `${bombPhase.width}%` }}
                title="Bomb active phase"
              >
                <span>Bomb</span>
              </div>
            ) : null}
            <div className="dr-mapfirst-track-base" />
            <div className="dr-mapfirst-track-fill" style={{ width: `${currentPercent}%` }} />
            <div className="dr-mapfirst-event-marks" aria-label="Replay events">
              {presentedMarkers.map(({ marker, percent, presentation }) => (
                <span
                  key={marker.key}
                  className={[
                    "dr-mapfirst-marker",
                    `dr-mapfirst-marker-${presentation}`,
                    marker.kind === "kill" && marker.killerSide === "CT" ? "dr-mapfirst-marker-kill-ct" : "",
                    marker.kind === "kill" && marker.killerSide === "T" ? "dr-mapfirst-marker-kill-t" : "",
                    marker.kind === "utility" && marker.utilitySide === "CT" ? "dr-mapfirst-marker-utility-ct" : "",
                    marker.kind === "utility" && marker.utilitySide === "T" ? "dr-mapfirst-marker-utility-t" : "",
                  ].filter(Boolean).join(" ")}
                  style={{ left: `${percent}%` }}
                  title={marker.label}
                >
                  {timelineMarkerIcon(presentation)}
                </span>
              ))}
            </div>
          </div>
          <div className="dr-mapfirst-current-needle" style={{ left: `${currentPercent}%` }} aria-hidden="true" />
          <input
            aria-label="Replay timeline"
            max={displayEndTick}
            min={displayStartTick}
            onChange={(event) => onTickChange(Number(event.target.value))}
            type="range"
            value={safeTick}
          />
        </div>

        <div className="dr-mapfirst-transport">
          {SPEEDS.map((entry) => (
            <button
              key={entry}
              className={entry === speed ? "dr-mapfirst-chip dr-mapfirst-chip-active" : "dr-mapfirst-chip"}
              onClick={() => onSpeedChange(entry)}
              type="button"
            >
              {entry}x
            </button>
          ))}
          <button className="dr-mapfirst-chip" onClick={() => onShowFreezeTimeChange(!showFreezeTime)} type="button">
            {showFreezeTime ? "Hide freeze" : "Freeze"}
          </button>
          <button className="dr-mapfirst-chip" onClick={onReset} type="button">Reset</button>
        </div>
      </div>

      <div className="dr-mapfirst-context-row">
        <span>{replay.map.displayName}</span>
        <span>{selectedPlayerName ? `Player focus: ${selectedPlayerName}` : "No player focus"}</span>
        <span>{Math.round(elapsedSeconds)}s elapsed</span>
      </div>
    </>
  );
}

function filterTimelineMarkersForDisplay(markers: PresentedTimelineMarker[]) {
  const hasPlanted = markers.some((entry) => entry.marker.bombType === "planted");
  const hasDefused = markers.some((entry) => entry.marker.bombType === "defused");

  return markers.filter((entry) => {
    if (entry.marker.bombType === "plant_start" && hasPlanted) {
      return false;
    }

    if (entry.marker.bombType === "defuse_start" && hasDefused) {
      return false;
    }

    return true;
  });
}

function resolveTimelineMarkerPresentation(marker: TimelineEventItem): TimelineMarkerPresentation {
  if (marker.kind === "kill") {
    return "kill";
  }

  if (marker.kind === "bomb") {
    switch (marker.bombType) {
      case "plant_start":
      case "planted":
        return "bomb-plant";
      case "defuse_start":
      case "defused":
        return "bomb-defuse";
      case "exploded":
        return "bomb-explode";
      default:
        return "bomb";
    }
  }

  return "utility";
}

function timelineMarkerIcon(presentation: TimelineMarkerPresentation) {
  switch (presentation) {
    case "bomb":
    case "bomb-plant":
    case "bomb-explode":
      return <UtilityIcon className="dr-mapfirst-marker-icon" kind="bomb" />;
    case "bomb-defuse":
      return <EquipmentIcon className="dr-mapfirst-marker-icon" kind="defuser" />;
    default:
      return null;
  }
}

function resolveBombPhase(markers: PresentedTimelineMarker[]) {
  const plantedMarker = markers.find((entry) => entry.marker.bombType === "planted")
    ?? markers.find((entry) => entry.marker.bombType === "plant_start");

  if (!plantedMarker) {
    return null;
  }

  const terminalMarker = markers.find(
    (entry) =>
      entry.marker.tick > plantedMarker.marker.tick &&
      (entry.marker.bombType === "defused" || entry.marker.bombType === "exploded"),
  );
  const left = Math.min(100, Math.max(0, plantedMarker.percent));
  const right = Math.min(100, Math.max(left + 0.5, terminalMarker?.percent ?? 100));

  return {
    left,
    width: Math.max(0.5, right - left),
  };
}

function buildRulerMarks(startTick: number, endTick: number, tickRate: number) {
  const range = Math.max(1, endTick - startTick);
  const safeTickRate = Math.max(1, tickRate);
  const durationSeconds = range / safeTickRate;
  const stepSeconds = durationSeconds > 90 ? 30 : 15;
  const marks = [];

  for (let seconds = 0; seconds <= durationSeconds + 0.1; seconds += stepSeconds) {
    const tick = startTick + seconds * safeTickRate;
    marks.push({
      key: `${seconds}`,
      label: `${Math.round(seconds)}s`,
      percent: Math.min(100, Math.max(0, ((tick - startTick) / range) * 100)),
    });
  }

  return marks;
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

function formatElapsed(seconds: number) {
  const wholeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(wholeSeconds / 60);
  const remainingSeconds = wholeSeconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

type RosterColumnProps = {
  players: LivePlayerState[];
  selectedPlayerId: string | null;
  side: Side;
  teamLabel: string;
  onSelectPlayer: (playerId: string) => void;
};

function RosterColumn({ players, selectedPlayerId, side, teamLabel, onSelectPlayer }: RosterColumnProps) {
  return (
    <section className={`dr-mapfirst-roster-column dr-mapfirst-roster-column-${side.toLowerCase()}`} aria-label={`${teamLabel} roster`}>
      <header className="dr-mapfirst-roster-header">
        <div>
          <span>{side}</span>
          <strong>{teamLabel}</strong>
        </div>
        <small>{players.filter((entry) => entry.alive).length} / {players.length}</small>
      </header>
      <div className="dr-mapfirst-roster-list">
        {players.map((player) => {
          const equipment = resolvePlayerEquipmentState({
            activeWeapon: player.activeWeapon,
            activeWeaponClass: player.activeWeaponClass,
            mainWeapon: player.mainWeapon,
          });
          const utility = utilityInventory(player);
          const weaponSlots = playerWeaponSlots(equipment.primaryWeapon, equipment.currentWeapon);

          return (
            <button
              key={player.playerId}
              className={[
                "dr-mapfirst-player-chip",
                `dr-mapfirst-player-chip-${side.toLowerCase()}`,
                player.alive ? "" : "dr-mapfirst-player-chip-dead",
                selectedPlayerId === player.playerId ? "dr-mapfirst-player-chip-active" : "",
              ].filter(Boolean).join(" ")}
              onClick={() => onSelectPlayer(player.playerId)}
              type="button"
            >
              <span className="dr-mapfirst-player-main">
                <span className="dr-mapfirst-player-name">{player.name}</span>
                <span className="dr-mapfirst-player-money">{formatMoney(player.money)}</span>
              </span>
              <span className="dr-mapfirst-player-loadout">
                {weaponSlots.map((slot) => (
                  <span key={`${slot.type}:${slot.weaponName ?? "unknown"}`} className={`dr-mapfirst-weapon-slot dr-mapfirst-weapon-slot-${slot.type}`}>
                    <WeaponGlyph className="dr-mapfirst-weapon-glyph" title={slot.label} weaponName={slot.weaponName} />
                    <span>{slot.label}</span>
                  </span>
                ))}
              </span>
              <span className="dr-mapfirst-player-meta">
                <span>{player.health == null ? "--" : Math.max(0, player.health)} HP</span>
                {player.armor && player.armor > 0 ? (
                  <span className="dr-mapfirst-equipment-item" title={`${player.armor} armor`}>
                    <EquipmentIcon className="dr-mapfirst-equipment-icon" kind="kevlar" title="Armor" />
                    {player.armor}
                  </span>
                ) : null}
                {player.hasHelmet ? (
                  <span className="dr-mapfirst-equipment-item" title="Helmet">
                    <EquipmentIcon className="dr-mapfirst-equipment-icon" kind="helmet" title="Helmet" />
                  </span>
                ) : null}
              </span>
              <span className="dr-mapfirst-utility-row" aria-label="Held utility">
                {utility.map((item) => (
                  <span
                    key={item.kind}
                    className={item.active ? "dr-mapfirst-utility-item dr-mapfirst-utility-item-active" : "dr-mapfirst-utility-item"}
                    style={{ color: utilityColorCss(item.kind) }}
                    title={item.title}
                  >
                    <UtilityIcon className="dr-mapfirst-utility-icon" kind={item.kind} title={item.title} />
                    {item.count > 1 ? <span>{item.count}</span> : null}
                  </span>
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

type RailIconItem = {
  active: boolean;
  count: number;
  kind: UtilityVisualKind;
  title: string;
};

function formatMoney(money: number | null) {
  if (money == null) {
    return "$-";
  }

  return `$${money.toLocaleString("en-US")}`;
}

function playerWeaponSlots(primaryWeapon: string | null, currentWeapon: string | null) {
  const slots = [];
  if (primaryWeapon) {
    slots.push({
      label: formatWeaponLabel(primaryWeapon),
      type: "primary",
      weaponName: primaryWeapon,
    });
  }

  if (currentWeapon && currentWeapon !== primaryWeapon) {
    slots.push({
      label: formatWeaponLabel(currentWeapon),
      type: "active",
      weaponName: currentWeapon,
    });
  }

  if (slots.length === 0) {
    slots.push({
      label: "--",
      type: "unknown",
      weaponName: null,
    });
  }

  return slots;
}

function utilityInventory(player: LivePlayerState): RailIconItem[] {
  const activeUtilityKind = resolvePlayerEquipmentState({
    activeWeapon: player.activeWeapon,
    activeWeaponClass: player.activeWeaponClass,
    mainWeapon: player.mainWeapon,
  }).activeUtilityKind;
  const capacities: Array<{ count: number | null; kind: UtilityKind; label: string; slots: number }> = [
    { count: player.flashbangs, kind: "flashbang", label: "Flashbang", slots: 2 },
    { count: player.smokes, kind: "smoke", label: "Smoke", slots: 1 },
    { count: player.heGrenades, kind: "hegrenade", label: "HE grenade", slots: 1 },
    { count: player.fireGrenades, kind: "molotov", label: "Molotov / incendiary", slots: 1 },
    { count: player.decoys, kind: "decoy", label: "Decoy", slots: 1 },
  ];

  const utility = capacities
    .map((entry) => ({
      active:
        (entry.kind === "molotov"
          ? activeUtilityKind === "molotov" || activeUtilityKind === "incendiary"
          : activeUtilityKind === entry.kind) && (entry.count ?? 0) > 0,
      count: Math.min(entry.slots, Math.max(0, entry.count ?? 0)),
      kind: normalizeUtilityVisualKind(entry.kind) ?? "fire",
      title: `${entry.label}${(entry.count ?? 0) > 1 ? ` x${Math.min(entry.slots, Math.max(0, entry.count ?? 0))}` : ""}`,
    }))
    .filter((entry) => entry.count > 0)
    .sort((left, right) => Number(right.active) - Number(left.active));

  if (!player.hasBomb) {
    return utility;
  }

  return [
    ...utility,
    {
      active: false,
      count: 1,
      kind: "bomb",
      title: "Bomb",
    },
  ];
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

function resolveDockControlLabel(analysisMode: ReplayAnalysisMode, positionsView: PositionsView) {
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
