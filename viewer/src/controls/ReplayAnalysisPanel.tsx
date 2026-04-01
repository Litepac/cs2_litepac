import type { UtilityAtlasScope, UtilityAtlasSourceFilter, UtilityAtlasTeamFilter } from "../replay/replayAnalysis";
import type { HeatmapScope, HeatmapSourceFilter, HeatmapTeamFilter } from "../replay/heatmapAnalysis";
import type { PositionsScope, PositionsSourceFilter, PositionsTeamFilter, PositionsView } from "../replay/positionsAnalysis";
import type { Side } from "../replay/derived";
import type { ReplayAnalysisMode } from "../replay/replayAnalysis";
import type { UtilityFocus } from "../replay/utilityFilter";

type AnalysisPanelPlayer = {
  playerId: string;
  displayName: string;
  side: Side;
};

type Props = {
  analysisMode: ReplayAnalysisMode;
  analysisPlayers: AnalysisPanelPlayer[];
  heatmapScope: HeatmapScope;
  heatmapSourceFilter: HeatmapSourceFilter;
  heatmapTeamFilter: HeatmapTeamFilter;
  positionsScope: PositionsScope;
  positionsSourceFilter: PositionsSourceFilter;
  positionsTeamFilter: PositionsTeamFilter;
  positionsView: PositionsView;
  showPositionRoundNumbers: boolean;
  selectedPlayerId: string | null;
  selectedPlayerName: string | null;
  utilityAtlasScope: UtilityAtlasScope;
  utilityAtlasSourceFilter: UtilityAtlasSourceFilter;
  utilityAtlasTeamFilter: UtilityAtlasTeamFilter;
  utilityFocus: UtilityFocus;
  onHeatmapScopeChange: (scope: HeatmapScope) => void;
  onHeatmapTeamFilterChange: (filter: HeatmapTeamFilter) => void;
  onPositionsScopeChange: (scope: PositionsScope) => void;
  onPositionsTeamFilterChange: (filter: PositionsTeamFilter) => void;
  onShowPositionRoundNumbersChange: (next: boolean) => void;
  onUtilityAtlasScopeChange: (scope: UtilityAtlasScope) => void;
  onUtilityAtlasTeamFilterChange: (filter: UtilityAtlasTeamFilter) => void;
  onUtilityFocusChange: (focus: UtilityFocus) => void;
  onAnalysisPlayerToggle: (playerId: string) => void;
  onAnalysisPlayerClear: () => void;
};

const ATLAS_SCOPES: Array<{ label: string; value: UtilityAtlasScope }> = [
  { label: "Round", value: "round" },
  { label: "Current Half", value: "sideBlock" },
  { label: "Full Match", value: "match" },
];

const ATLAS_TEAM_OPTIONS: Array<{ label: string; value: UtilityAtlasTeamFilter }> = [
  { label: "All", value: "all" },
  { label: "CT", value: "CT" },
  { label: "T", value: "T" },
];

const UTILITY_OPTIONS: Array<{ label: string; value: UtilityFocus }> = [
  { label: "Smoke", value: "smoke" },
  { label: "Flash", value: "flashbang" },
  { label: "HE", value: "hegrenade" },
  { label: "Molotov", value: "fire" },
  { label: "Decoy", value: "decoy" },
  { label: "All", value: "all" },
];

export function ReplayAnalysisPanel({
  analysisMode,
  analysisPlayers,
  heatmapScope,
  heatmapSourceFilter,
  heatmapTeamFilter,
  positionsScope,
  positionsSourceFilter,
  positionsTeamFilter,
  positionsView,
  showPositionRoundNumbers,
  selectedPlayerId,
  selectedPlayerName,
  utilityAtlasScope,
  utilityAtlasSourceFilter,
  utilityAtlasTeamFilter,
  utilityFocus,
  onHeatmapScopeChange,
  onHeatmapTeamFilterChange,
  onPositionsScopeChange,
  onPositionsTeamFilterChange,
  onShowPositionRoundNumbersChange,
  onUtilityAtlasScopeChange,
  onUtilityAtlasTeamFilterChange,
  onUtilityFocusChange,
  onAnalysisPlayerToggle,
  onAnalysisPlayerClear,
}: Props) {
  const atlasMode = analysisMode === "utilityAtlas";
  const heatmapMode = analysisMode === "heatmap";
  const positionsMode = analysisMode === "positions";
  const selectedActive =
    selectedPlayerId != null &&
    (atlasMode ? utilityAtlasSourceFilter === "selected" : heatmapMode ? heatmapSourceFilter === "selected" : positionsSourceFilter === "selected");
  const positionsPlayerSideLocked = positionsMode && positionsView === "player" && !selectedActive;
  const scopeValue = atlasMode ? utilityAtlasScope : heatmapMode ? heatmapScope : positionsScope;
  const teamValue = atlasMode ? utilityAtlasTeamFilter : heatmapMode ? heatmapTeamFilter : positionsTeamFilter;
  const panelTitle = atlasMode
    ? "Utility Atlas"
    : heatmapMode
      ? "Heatmap"
      : positionsView === "player"
        ? "Position Player"
        : "Position Paths";
  const panelHint = heatmapMode
    ? selectedActive
      ? "Selected-player hotspots across the selected replay scope."
      : "All-player occupancy across the selected replay scope."
    : positionsMode && positionsView === "player"
      ? selectedActive
        ? "Use the main replay timeline to compare one selected player's replay token across their CT, T, or all rounds."
        : "Use the main replay timeline to compare all-player replay tokens across all rounds. Select one player to unlock CT/T round splits."
      : positionsMode
        ? "Compare sampled movement paths across the selected replay scope."
      : null;
  const resetLabel = "All Players";
  const ctPlayers = analysisPlayers.filter((player) => player.side === "CT");
  const tPlayers = analysisPlayers.filter((player) => player.side === "T");

  return (
    <section className="replay-analysis-panel">
      <div className="replay-analysis-panel-header">
        <div className="replay-analysis-panel-heading">
          <span className="replay-analysis-panel-label">Analysis</span>
          <strong>{panelTitle}</strong>
          {panelHint ? <small className="replay-analysis-panel-hint">{panelHint}</small> : null}
        </div>
        {selectedActive ? (
          <span className="replay-analysis-selection-note">
            {selectedPlayerName ?? "Selected player"} {heatmapMode ? "hotspots" : positionsMode && positionsView === "player" ? "player view" : "focus"}
          </span>
        ) : heatmapMode ? (
          <span className="replay-analysis-selection-note">All-player occupancy</span>
        ) : null}
      </div>

      {!positionsMode || positionsView === "paths" ? (
        <div className="replay-analysis-control-group replay-analysis-control-group-inline">
          <span className="replay-analysis-control-label">Scope</span>
          <div className="timeline-segmented-row replay-analysis-segmented-row">
            {ATLAS_SCOPES.map((option) => (
              <button
                key={option.value}
                className={option.value === scopeValue ? "control-button control-button-active" : "control-button"}
                onClick={() =>
                  atlasMode
                    ? onUtilityAtlasScopeChange(option.value)
                    : heatmapMode
                      ? onHeatmapScopeChange(option.value)
                      : onPositionsScopeChange(option.value)
                }
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="replay-analysis-control-group replay-analysis-control-group-inline">
        <span className="replay-analysis-control-label">Team</span>
        <div className="timeline-segmented-row replay-analysis-segmented-row">
          {ATLAS_TEAM_OPTIONS.map((option) => (
            <button
              key={option.value}
              className={option.value === teamValue ? "control-button control-button-active" : "control-button"}
              disabled={positionsPlayerSideLocked && option.value !== "all"}
              onClick={() =>
                atlasMode
                  ? onUtilityAtlasTeamFilterChange(option.value)
                  : heatmapMode
                    ? onHeatmapTeamFilterChange(option.value)
                    : onPositionsTeamFilterChange(option.value)
              }
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {atlasMode ? (
        <div className="replay-analysis-control-group replay-analysis-control-group-inline">
          <span className="replay-analysis-control-label">Utility</span>
          <div className="timeline-segmented-row replay-analysis-segmented-row replay-analysis-segmented-row-wrap">
            {UTILITY_OPTIONS.map((option) => (
              <button
                key={option.value}
                className={option.value === utilityFocus ? "control-button control-button-active" : "control-button"}
                onClick={() => onUtilityFocusChange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="replay-analysis-player-section">
        <div className="replay-analysis-player-section-header">
          <span className="replay-analysis-control-label">{atlasMode ? "Throwers" : heatmapMode && selectedActive ? "Player Focus" : "Players"}</span>
          <button
            className={selectedActive ? "control-button control-button-active replay-analysis-player-reset" : "control-button replay-analysis-player-reset"}
            onClick={onAnalysisPlayerClear}
          >
            {resetLabel}
          </button>
        </div>

        <AnalysisPlayerGroup
          title="CT"
          players={ctPlayers}
          selectedPlayerId={selectedPlayerId}
          selectedActive={selectedActive}
          onTogglePlayer={onAnalysisPlayerToggle}
        />
        <AnalysisPlayerGroup
          title="T"
          players={tPlayers}
          selectedPlayerId={selectedPlayerId}
          selectedActive={selectedActive}
          onTogglePlayer={onAnalysisPlayerToggle}
        />

        {positionsMode && positionsView === "player" ? (
          <>
            <div className="replay-analysis-control-group replay-analysis-control-group-inline">
              <span className="replay-analysis-control-label">Options</span>
              <div className="timeline-segmented-row replay-analysis-segmented-row replay-analysis-segmented-row-wrap">
                <button
                  className={showPositionRoundNumbers ? "control-button control-button-active" : "control-button"}
                  onClick={() => onShowPositionRoundNumbersChange(!showPositionRoundNumbers)}
                >
                  Show Round Number
                </button>
              </div>
            </div>
            <small className="replay-analysis-panel-hint replay-analysis-panel-hint-inline">
              {selectedActive
                ? "Synced to the main replay timeline. Click any ghost token to jump into that round."
                : "Synced to the main replay timeline. Use All Players for broad comparison or choose one player to compare their CT, T, or all rounds."}
            </small>
          </>
        ) : null}
      </div>
    </section>
  );
}

type AnalysisPlayerGroupProps = {
  title: string;
  players: AnalysisPanelPlayer[];
  selectedPlayerId: string | null;
  selectedActive: boolean;
  onTogglePlayer: (playerId: string) => void;
};

function AnalysisPlayerGroup({
  title,
  players,
  selectedPlayerId,
  selectedActive,
  onTogglePlayer,
}: AnalysisPlayerGroupProps) {
  if (players.length === 0) {
    return null;
  }

  return (
    <div className="replay-analysis-player-group">
      <span className="replay-analysis-player-group-title">{title}</span>
      <div className="replay-analysis-player-grid">
        {players.map((player) => {
          const active = selectedActive && player.playerId === selectedPlayerId;
          return (
            <button
              key={player.playerId}
              className={active ? "replay-analysis-player-chip replay-analysis-player-chip-active" : "replay-analysis-player-chip"}
              onClick={() => onTogglePlayer(player.playerId)}
              title={player.displayName}
            >
              {player.displayName}
            </button>
          );
        })}
      </div>
    </div>
  );
}
