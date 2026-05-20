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
import { ReplayDrawingToolbar } from "./replay-map-first/ReplayDrawingToolbar";
import { ReplayDock } from "./replay-map-first/ReplayDock";
import { ReplayHud } from "./replay-map-first/ReplayHud";
import { ReplayModeRail } from "./replay-map-first/ReplayModeRail";
import { ReplayRosterColumn } from "./replay-map-first/ReplayRosterColumn";
import { useReplayDrawing } from "./replay-map-first/useReplayDrawing";
import { useReplayHotkeys } from "./replay-map-first/useReplayHotkeys";
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
  onOpenSelectedDeathProof: (entry: DeathReviewEntry) => void;
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
  onOpenSelectedDeathProof,
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
  const {
    clearDrawings,
    continueDrawing,
    drawingStrokes,
    setStageToolMode,
    stageToolMode,
    startDrawing,
    stopDrawing,
  } = useReplayDrawing({
    activeRoundIndex,
    replayId: replay.sourceDemo.sha256,
  });
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

  useReplayHotkeys({
    clearDrawings,
    setStageToolMode,
    togglePlayback: playback.togglePlayback,
  });

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
        selectedUtilityAtlasKey={selectedUtilityAtlasKey}
        showPositionRoundNumbers={showPositionRoundNumbers}
        utilityAtlasCount={utilityAtlasEntries.length}
        utilityAtlasScope={utilityAtlasScope}
        utilityAtlasTeamFilter={utilityAtlasTeamFilter}
        utilityFocus={utilityFocus}
        onDisablePositionPlayerCompare={onDisablePositionPlayerCompare}
        onEnablePositionPlayerBroadCompare={onEnablePositionPlayerBroadCompare}
        onEnablePositionPlayerCompare={onEnablePositionPlayerCompare}
        onOpenSelectedDeathProof={onOpenSelectedDeathProof}
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
              onClear={clearDrawings}
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
  selectedUtilityAtlasKey,
  showPositionRoundNumbers,
  utilityAtlasCount,
  utilityAtlasScope,
  utilityAtlasTeamFilter,
  utilityFocus,
  onDisablePositionPlayerCompare,
  onEnablePositionPlayerBroadCompare,
  onEnablePositionPlayerCompare,
  onOpenSelectedDeathProof,
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
  selectedUtilityAtlasKey: string | null;
  showPositionRoundNumbers: boolean;
  utilityAtlasCount: number;
  utilityAtlasScope: UtilityAtlasScope;
  utilityAtlasTeamFilter: UtilityAtlasTeamFilter;
  utilityFocus: UtilityFocus;
  onDisablePositionPlayerCompare: () => void;
  onEnablePositionPlayerBroadCompare: () => void;
  onEnablePositionPlayerCompare: () => void;
  onOpenSelectedDeathProof: (entry: DeathReviewEntry) => void;
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
  const playerStudyMessage = resolvePlayerStudyMessage({
    positionsView,
    positionPlayerBroadCompareEnabled,
    positionPlayerCompareEnabled,
    positionPlayerSelectedCount,
    selectedPlayerName,
  });
  const utilityReviewMessage = resolveUtilityReviewMessage({
    selectedUtilityAtlasKey,
    utilityAtlasCount,
    utilityFocus,
  });

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
            <p className="dr-mapfirst-analysis-hint">{utilityReviewMessage}</p>
            <Segmented items={SCOPE_OPTIONS} selectedValue={utilityAtlasScope} onChange={onUtilityAtlasScopeChange} />
            <Segmented items={TEAM_FILTERS} selectedValue={utilityAtlasTeamFilter} onChange={onUtilityAtlasTeamFilterChange} />
            <Segmented items={UTILITY_OPTIONS} selectedValue={utilityFocus} onChange={onUtilityFocusChange} />
          </>
        ) : null}
        {analysisMode === "deathReview" ? (
          <DeathReviewSummary
            entry={selectedDeathReviewEntry}
            deathCount={deathReviewEntries.length}
            onOpenProof={onOpenSelectedDeathProof}
          />
        ) : null}
        {analysisMode === "positions" && positionsView === "paths" ? (
          <Segmented items={ROUND_SET_OPTIONS} selectedValue={positionsRoundSet} onChange={setPositionsRoundSet} />
        ) : null}
        {analysisMode === "positions" && positionsView === "player" ? (
          <>
            <p className="dr-mapfirst-analysis-hint">{playerStudyMessage}</p>
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
  onOpenProof,
}: {
  deathCount: number;
  entry: DeathReviewEntry | null;
  onOpenProof: (entry: DeathReviewEntry) => void;
}) {
  if (!entry) {
    return (
      <div className="dr-mapfirst-death-review-card dr-mapfirst-death-review-card-empty">
        <strong>{deathCount} deaths in round</strong>
        <span>Select a death marker to inspect victim, killer, trade, flash, and support evidence.</span>
      </div>
    );
  }

  return (
    <div className={`dr-mapfirst-death-review-card dr-mapfirst-death-review-card-${entry.victimSide?.toLowerCase() ?? "neutral"}`}>
      <div className="dr-mapfirst-death-review-main">
        <strong>{entry.victimName}</strong>
        <span>{entry.timeDisplay ?? "Clock unknown"}</span>
      </div>
      <div className="dr-mapfirst-death-review-status-row">
        <span className={`dr-mapfirst-death-review-status dr-mapfirst-death-review-status-${entry.tradeState}`}>
          {tradeStateLabel(entry)}
        </span>
        {entry.victimFlashed ? <span className="dr-mapfirst-death-review-status">Flashed</span> : null}
        {entry.victimUtilityCount != null && entry.victimUtilityCount > 0 ? (
          <span className="dr-mapfirst-death-review-status">{entry.victimUtilityCount} util left</span>
        ) : null}
      </div>
      <span className="dr-mapfirst-death-review-section">Canonical event</span>
      <DeathReviewFactRow label="Killed by" value={entry.killerName} />
      <DeathReviewFactRow label="Weapon" value={`${entry.weaponLabel}${entry.headshot ? " HS" : ""}`} />
      {entry.assisterName ? (
        <DeathReviewFactRow label="Assist" value={entry.assisterName} />
      ) : null}
      <span className="dr-mapfirst-death-review-section">Measured evidence</span>
      <DeathReviewFactRow label="5s trade" value={tradeStateLabel(entry)} estimated />
      <DeathReviewFactRow
        label="Support nearby"
        value={entry.nearbyTeammates == null ? "Unknown" : `${entry.nearbyTeammates}`}
        estimated
      />
      <DeathReviewFactRow label="Victim flashed" value={booleanFactLabel(entry.victimFlashed)} />
      <DeathReviewFactRow label="Killer flashed" value={booleanFactLabel(entry.killerFlashed)} />
      <DeathReviewFactRow
        label="Utility left"
        value={entry.victimUtilityCount == null ? "Unknown" : `${entry.victimUtilityCount}`}
        estimated
      />
      <button className="dr-mapfirst-death-review-proof" type="button" onClick={() => onOpenProof(entry)}>
        Open proof tick
      </button>
    </div>
  );
}

function DeathReviewFactRow({ estimated, label, value }: { estimated?: boolean; label: string; value: string }) {
  return (
    <div className={estimated ? "dr-mapfirst-death-review-row dr-mapfirst-death-review-row-estimated" : "dr-mapfirst-death-review-row"}>
      <span className="dr-mapfirst-death-review-label">
        {label}
        {estimated ? (
          <em className="dr-mapfirst-death-review-estimate-tag" title="Viewer-derived estimate">
            EST
          </em>
        ) : null}
      </span>
      <b>{value}</b>
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

function resolvePlayerStudyMessage({
  positionsView,
  positionPlayerBroadCompareEnabled,
  positionPlayerCompareEnabled,
  positionPlayerSelectedCount,
  selectedPlayerName,
}: {
  positionsView: PositionsView;
  positionPlayerBroadCompareEnabled: boolean;
  positionPlayerCompareEnabled: boolean;
  positionPlayerSelectedCount: number;
  selectedPlayerName: string | null;
}) {
  if (positionsView !== "player") {
    return "";
  }

  if (positionPlayerBroadCompareEnabled) {
    return "All-player comparison is noisy by design. Pick one player when you want a clean timing study.";
  }

  if (positionPlayerCompareEnabled) {
    return positionPlayerSelectedCount > 0
      ? "Click player cards to add or remove comparison targets. Click a ghost to open the proof tick."
      : "Pick up to three players from the rosters to compare their same-clock positions.";
  }

  if (!selectedPlayerName) {
    return "Select a player from either roster to study where they are at this same round clock across rounds.";
  }

  return "Click a ghost marker to jump into the exact round and tick. If the map is empty, this player was not alive at this clock in the filtered rounds.";
}

function resolveUtilityReviewMessage({
  selectedUtilityAtlasKey,
  utilityAtlasCount,
  utilityFocus,
}: {
  selectedUtilityAtlasKey: string | null;
  utilityAtlasCount: number;
  utilityFocus: UtilityFocus;
}) {
  if (selectedUtilityAtlasKey) {
    return "One throw selected. Click the marker again to clear, or use the filters to inspect a different family.";
  }

  if (utilityAtlasCount === 0) {
    return "No parser-backed utility matches this filter for the current scope.";
  }

  const family = utilityFocus === "all" ? "utility" : UTILITY_OPTIONS.find((entry) => entry.value === utilityFocus)?.label.toLowerCase() ?? "utility";
  return `${utilityAtlasCount} ${family} ${utilityAtlasCount === 1 ? "throw" : "throws"} visible. Click one marker to isolate its path and jump into Live.`;
}
