import { ReplayStage } from "../canvas/ReplayStage";
import { scoreForSide, sideTeam, type Side } from "../replay/derived";
import type { HeatmapScope, HeatmapSnapshot, HeatmapSourceFilter, HeatmapTeamFilter } from "../replay/heatmapAnalysis";
import { livePlayersAtTick } from "../replay/live";
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
import { TimelinePanel } from "../timeline/TimelinePanel";
import { KillFeed } from "./KillFeed";
import { ReplayAnalysisPanel } from "./ReplayAnalysisPanel";
import { TeamRosterPanel } from "./RosterPanel";

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

export function ReplayReviewPage({
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
  const liveMode = analysisMode === "live";
  const timer = resolveRoundTimer(replay, round, playback.renderTickRounded);
  const livePlayers = livePlayersAtTick(replay, round, playback.renderTickRounded);
  const ctAlive = livePlayers.filter((entry) => entry.side === "CT" && entry.alive).length;
  const tAlive = livePlayers.filter((entry) => entry.side === "T" && entry.alive).length;
  const ctTeam = sideTeam(replay, round, "CT");
  const tTeam = sideTeam(replay, round, "T");

  return (
    <div className="dr-review-page">
      <section className="dr-review-canvas" aria-label="Replay review canvas">
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

        <header className="dr-review-hud" aria-label="Replay status">
          <div className="dr-review-hud-match">
            <span>{replay.map.displayName}</span>
            <strong>Round {activeRoundIndex + 1}</strong>
          </div>
          <div className="dr-review-hud-score">
            <span>{ctTeam?.displayName ?? "CT"}</span>
            <strong>{scoreForSide(round, "CT", "before")}</strong>
            <b>{timer?.display ?? playback.roundClock ?? "--:--"}</b>
            <strong>{scoreForSide(round, "T", "before")}</strong>
            <span>{tTeam?.displayName ?? "T"}</span>
          </div>
          <div className="dr-review-hud-state">
            <span>{resolveModeLabel(analysisMode, positionsView, livePlayerContextMode)}</span>
            <strong>{ctAlive} CT / {tAlive} T</strong>
          </div>
        </header>

        {liveMode ? (
          <>
            <aside className="dr-review-roster-tray dr-review-roster-tray-ct" aria-label="CT roster">
              <TeamRosterPanel
                className="dr-review-roster-panel dr-review-roster-panel-ct"
                currentTick={playback.renderTickRounded}
                onSelectPlayer={onReplayPlayerSelect}
                replay={replay}
                round={round}
                selectedPlayerId={selectedPlayerId}
                side="CT"
              />
            </aside>
            <aside className="dr-review-roster-tray dr-review-roster-tray-t" aria-label="T roster">
              <TeamRosterPanel
                className="dr-review-roster-panel dr-review-roster-panel-t"
                currentTick={playback.renderTickRounded}
                onSelectPlayer={onReplayPlayerSelect}
                replay={replay}
                round={round}
                selectedPlayerId={selectedPlayerId}
                side="T"
              />
            </aside>
            <KillFeed currentTick={playback.renderTickRounded} replay={replay} round={round} />
          </>
        ) : null}
      </section>

      <section className="dr-review-dock" aria-label="Replay review controls">
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
          positionPlayerBroadCompareEnabled={positionPlayerBroadCompareEnabled}
          positionPlayerCompareEnabled={positionPlayerCompareEnabled}
          positionPlayerMaxSelections={positionPlayerMaxSelections}
          positionPlayerSelectedKeys={positionPlayerSelectedKeys}
          showPositionRoundNumbers={showPositionRoundNumbers}
          selectedPlayerId={selectedPlayerId}
          selectedPlayerName={selectedPlayerName}
          utilityAtlasScope={utilityAtlasScope}
          utilityAtlasSourceFilter={utilityAtlasSourceFilter}
          utilityAtlasTeamFilter={utilityAtlasTeamFilter}
          utilityFocus={utilityFocus}
          onSelectAnalysisMode={onSelectAnalysisMode}
          onSelectPositionsView={onSelectPositionsView}
          onHeatmapScopeChange={onHeatmapScopeChange}
          onHeatmapTeamFilterChange={onHeatmapTeamFilterChange}
          onPositionsScopeChange={onPositionsScopeChange}
          onPositionsTeamFilterChange={onPositionsTeamFilterChange}
          onShowPositionRoundNumbersChange={onShowPositionRoundNumbersChange}
          onUtilityAtlasScopeChange={onUtilityAtlasScopeChange}
          onUtilityAtlasTeamFilterChange={onUtilityAtlasTeamFilterChange}
          onUtilityFocusChange={onUtilityFocusChange}
          onAnalysisPlayerToggle={onAnalysisPlayerToggle}
          onAnalysisPlayerClear={onAnalysisPlayerClear}
          onEnablePositionPlayerCompare={onEnablePositionPlayerCompare}
          onEnablePositionPlayerBroadCompare={onEnablePositionPlayerBroadCompare}
          onDisablePositionPlayerCompare={onDisablePositionPlayerCompare}
        />

        <TimelinePanel
          activeRoundIndex={activeRoundIndex}
          analysisMode={analysisMode}
          currentTick={playback.tick}
          heatmapLabel={heatmapLabel}
          heatmapScope={heatmapScope}
          heatmapSnapshot={heatmapSnapshot}
          initialRoundTick={playback.initialRoundTick}
          livePlayerContextMode={liveMode && livePlayerContextMode}
          replay={replay}
          markers={markers}
          playing={playback.playing}
          roundClock={playback.roundClock}
          round={round}
          rounds={replay.rounds}
          showFreezeTime={showFreezeTime}
          speed={playback.speed}
          tick={playback.tick}
          tickRate={replay.match.tickRate}
          positionPlayerSnapshots={positionPlayerSnapshots}
          positionPlayerBroadCompareEnabled={positionPlayerBroadCompareEnabled}
          positionPlayerSelectedCount={positionPlayerSelectedCount}
          positionTrailEntries={positionTrailEntries}
          positionsLabel={positionsLabel}
          positionsTeamFilter={positionsTeamFilter}
          positionsView={positionsView}
          utilityAtlasEntries={utilityAtlasEntries}
          utilityAtlasLabel={utilityAtlasLabel}
          utilityFocus={utilityFocus}
          onSelectRound={onSelectRound}
          onPlayToggle={playback.togglePlayback}
          onReset={playback.resetPlayback}
          onSpeedChange={playback.setSpeed}
          onShowFreezeTimeChange={onShowFreezeTimeChange}
          onTickChange={playback.changeTick}
          onUtilityFocusChange={onUtilityFocusChange}
          selectedPlayerId={selectedPlayerId}
          selectedPlayerName={selectedPlayerName}
        />
      </section>
    </div>
  );
}

function resolveModeLabel(analysisMode: ReplayAnalysisMode, positionsView: PositionsView, livePlayerContextMode: boolean) {
  if (analysisMode === "live") {
    return livePlayerContextMode ? "Live focus" : "Live replay";
  }

  if (analysisMode === "utilityAtlas") {
    return "Utility review";
  }

  if (analysisMode === "heatmap") {
    return "Heatmap";
  }

  return positionsView === "player" ? "Position player" : "Path review";
}
