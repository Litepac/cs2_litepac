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
  teamId: string;
  teamName: string;
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
  positionPlayerMaxSelections: number;
  positionPlayerSelectedKeys: string[];
  showPositionRoundNumbers: boolean;
  selectedPlayerId: string | null;
  selectedPlayerName: string | null;
  utilityAtlasScope: UtilityAtlasScope;
  utilityAtlasSourceFilter: UtilityAtlasSourceFilter;
  utilityAtlasTeamFilter: UtilityAtlasTeamFilter;
  utilityFocus: UtilityFocus;
  onSelectAnalysisMode: (mode: ReplayAnalysisMode) => void;
  onSelectPositionsView: (view: PositionsView) => void;
  onHeatmapScopeChange: (scope: HeatmapScope) => void;
  onHeatmapTeamFilterChange: (filter: HeatmapTeamFilter) => void;
  onPositionsScopeChange: (scope: PositionsScope) => void;
  onPositionsTeamFilterChange: (filter: PositionsTeamFilter) => void;
  onShowPositionRoundNumbersChange: (next: boolean) => void;
  onUtilityAtlasScopeChange: (scope: UtilityAtlasScope) => void;
  onUtilityAtlasTeamFilterChange: (filter: UtilityAtlasTeamFilter) => void;
  onUtilityFocusChange: (focus: UtilityFocus) => void;
  onAnalysisPlayerToggle: (playerIds: string[], playerSide: Side) => void;
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

const ANALYSIS_MODE_OPTIONS: Array<{
  label: string;
  mode: ReplayAnalysisMode;
  positionsView?: PositionsView;
}> = [
  { label: "Live", mode: "live" },
  { label: "Utility", mode: "utilityAtlas" },
  { label: "Paths", mode: "positions", positionsView: "paths" },
  { label: "Player", mode: "positions", positionsView: "player" },
  { label: "Heatmap", mode: "heatmap" },
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
  positionPlayerMaxSelections,
  positionPlayerSelectedKeys,
  showPositionRoundNumbers,
  selectedPlayerId,
  selectedPlayerName,
  utilityAtlasScope,
  utilityAtlasSourceFilter,
  utilityAtlasTeamFilter,
  utilityFocus,
  onSelectAnalysisMode,
  onSelectPositionsView,
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
  const liveMode = analysisMode === "live";
  const atlasMode = analysisMode === "utilityAtlas";
  const heatmapMode = analysisMode === "heatmap";
  const positionsMode = analysisMode === "positions";
  const positionPlayerCompareMode = positionsMode && positionsView === "player";
  const positionPlayerSelectedCount = positionPlayerSelectedKeys.length;
  const selectedActive =
    atlasMode
      ? selectedPlayerId != null && utilityAtlasSourceFilter === "selected"
      : heatmapMode
        ? selectedPlayerId != null && heatmapSourceFilter === "selected"
        : positionPlayerCompareMode
          ? positionsSourceFilter === "selected" && positionPlayerSelectedCount > 0
          : selectedPlayerId != null && positionsSourceFilter === "selected";
  const scopeValue = atlasMode ? utilityAtlasScope : heatmapMode ? heatmapScope : positionsScope;
  const teamValue = atlasMode ? utilityAtlasTeamFilter : heatmapMode ? heatmapTeamFilter : positionsTeamFilter;
  const panelTitle = liveMode
    ? "Live Replay"
    : atlasMode
      ? "Utility Atlas"
      : heatmapMode
        ? "Heatmap"
        : positionsView === "player"
          ? "Position Player"
          : "Position Paths";
  const panelHint = liveMode
    ? "Watch the round, jump between moments in the bottom dock, and click players for roster focus."
    : heatmapMode
      ? selectedActive
        ? "Selected-player hotspots across the selected replay scope."
        : "All-player occupancy across the selected replay scope."
      : positionPlayerCompareMode
        ? selectedActive
          ? `Use the main replay timeline to compare ${positionPlayerSelectedCount === 1 ? "one movement pattern" : `${positionPlayerSelectedCount} movement patterns`} across matching rounds.`
          : `Use the main replay timeline to compare all-player replay tokens across CT, T, or all rounds. Select up to ${positionPlayerMaxSelections} players for a cleaner comparison set.`
        : positionsMode
          ? "Compare sampled movement paths across the selected replay scope."
          : null;
  const resetLabel = "All Players";
  const ctPlayers = analysisPlayers.filter((player) => player.side === "CT");
  const tPlayers = analysisPlayers.filter((player) => player.side === "T");
  const positionPlayerRoster = positionPlayerCompareMode ? buildPositionPlayerRoster(analysisPlayers) : [];

  return (
    <section className="replay-analysis-panel">
      <div className="replay-analysis-panel-header">
        <div className="replay-analysis-panel-heading">
          <span className="replay-analysis-panel-label">Analysis</span>
          <strong>{panelTitle}</strong>
          {panelHint ? <small className="replay-analysis-panel-hint">{panelHint}</small> : null}
        </div>
        {selectedActive && !positionPlayerCompareMode ? (
          <span className="replay-analysis-selection-note">
            {selectedPlayerName ?? "Selected player"} {heatmapMode ? "hotspots" : "focus"}
          </span>
        ) : heatmapMode ? (
          <span className="replay-analysis-selection-note">All-player occupancy</span>
        ) : null}
      </div>

      <div className="replay-analysis-mode-strip" role="tablist" aria-label="Replay analysis modes">
        {ANALYSIS_MODE_OPTIONS.map((option) => {
          const active =
            option.mode === analysisMode && (option.mode !== "positions" || option.positionsView === positionsView);

          return (
            <button
              key={`${option.mode}:${option.positionsView ?? option.mode}`}
              type="button"
              role="tab"
              aria-selected={active}
              className={
                active
                  ? "replay-analysis-mode-button replay-analysis-mode-button-active"
                  : "replay-analysis-mode-button"
              }
              onClick={() => {
                if (option.positionsView) {
                  onSelectPositionsView(option.positionsView);
                }
                onSelectAnalysisMode(option.mode);
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {liveMode ? null : (
        <div className="replay-analysis-panel-body">

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
          <span className="replay-analysis-control-label">
            {atlasMode
              ? "Throwers"
              : heatmapMode && selectedActive
                ? "Player Focus"
                : positionPlayerCompareMode
                  ? "Compare"
                  : "Players"}
          </span>
          {positionPlayerCompareMode ? (
            <span className="replay-analysis-selection-note">
              {positionPlayerSelectedCount}/{positionPlayerMaxSelections} selected
            </span>
          ) : null}
          <button
            className={selectedActive ? "control-button control-button-active replay-analysis-player-reset" : "control-button replay-analysis-player-reset"}
            onClick={onAnalysisPlayerClear}
          >
            {resetLabel}
          </button>
        </div>

        {positionPlayerCompareMode ? (
          <PositionPlayerRoster
            disableUnselected={positionPlayerSelectedCount >= positionPlayerMaxSelections}
            players={positionPlayerRoster}
            selectedPlayerKeys={positionPlayerSelectedKeys}
            selectedTeamFilter={teamValue}
            onTogglePlayer={onAnalysisPlayerToggle}
          />
        ) : (
          <>
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
          </>
        )}

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
                ? "Synced to the main replay timeline. Click any ghost token to jump into that round; the first selected player becomes live focus."
                : `Synced to the main replay timeline. Use All Players for broad comparison or choose up to ${positionPlayerMaxSelections} players for a tighter comparison set.`}
            </small>
          </>
        ) : null}
      </div>
        </div>
      )}
    </section>
  );
}

type AnalysisPlayerGroupProps = {
  title: string;
  players: AnalysisPanelPlayer[];
  selectedPlayerId: string | null;
  selectedActive: boolean;
  onTogglePlayer: (playerIds: string[], playerSide: Side) => void;
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
    <div className={`replay-analysis-player-group replay-analysis-player-group-${title.toLowerCase()}`}>
      <span className={`replay-analysis-player-group-title replay-analysis-player-group-title-${title.toLowerCase()}`}>
        {title}
      </span>
      <div className="replay-analysis-player-grid">
        {players.map((player) => {
          const selectionKey = `${player.side}:${player.playerId}`;
          const active = selectedActive && player.playerId === selectedPlayerId;
          return (
            <button
              key={selectionKey}
              className={
                active
                  ? `replay-analysis-player-chip replay-analysis-player-chip-${player.side.toLowerCase()} replay-analysis-player-chip-active`
                  : `replay-analysis-player-chip replay-analysis-player-chip-${player.side.toLowerCase()}`
              }
              onClick={() => onTogglePlayer([player.playerId], player.side)}
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

type PositionPlayerRosterRow = {
  displaySide: Side;
  displayName: string;
  playerIdsBySide: Partial<Record<Side, string[]>>;
  rowKey: string;
  teamId: string;
  teamName: string;
};

type PositionPlayerSideGroup = {
  rows: PositionPlayerRosterRow[];
  side: Side;
};

type PositionPlayerRosterProps = {
  disableUnselected: boolean;
  players: PositionPlayerSideGroup[];
  selectedPlayerKeys: string[];
  selectedTeamFilter: PositionsTeamFilter;
  onTogglePlayer: (playerIds: string[], playerSide: Side) => void;
};

function PositionPlayerRoster({
  disableUnselected,
  players,
  selectedPlayerKeys,
  selectedTeamFilter,
  onTogglePlayer,
}: PositionPlayerRosterProps) {
  if (players.length === 0) {
    return null;
  }

  return (
    <div className="position-player-roster">
      {players.map((group) => (
        <div
          className={`replay-analysis-player-group replay-analysis-player-group-${group.side.toLowerCase()}`}
          key={group.side}
        >
          <span
            className={`replay-analysis-player-group-title replay-analysis-player-group-title-${group.side.toLowerCase()}`}
          >
            {group.side}
          </span>
          <div className="replay-analysis-player-grid">
            {group.rows.map((player) => {
              const playerIds = player.playerIdsBySide[group.side] ?? [];
              const selectionKey = toPositionPlayerRosterSelectionKey(playerIds, group.side);
              const active = selectedPlayerKeys.includes(selectionKey);
              const sideVisible = selectedTeamFilter === "all" || selectedTeamFilter === group.side;
              const disabled = disableUnselected && !active;

              return (
                <button
                  className={
                    active
                      ? `replay-analysis-player-chip replay-analysis-player-chip-${group.side.toLowerCase()} replay-analysis-player-chip-active`
                      : `replay-analysis-player-chip replay-analysis-player-chip-${group.side.toLowerCase()}`
                  }
                  disabled={disabled}
                  key={`${group.side}:${player.rowKey}`}
                  onClick={() => onTogglePlayer(playerIds, group.side)}
                  title={
                    disabled
                      ? `Selection limit reached (${selectedPlayerKeys.length} players)`
                      : `${player.displayName} ${group.side}${sideVisible ? "" : " - outside current team filter, click to add and switch back to All"}`
                  }
                  type="button"
                >
                  {player.displayName}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function buildPositionPlayerRoster(players: AnalysisPanelPlayer[]) {
  const roster = new Map<string, PositionPlayerRosterRow>();

  for (const player of players) {
    const rowKey = `${player.teamId}:${player.displayName.trim().toLowerCase() || player.playerId}`;
    const row = roster.get(rowKey);
    if (!row) {
      roster.set(rowKey, {
        displaySide: player.side,
        displayName: player.displayName,
        playerIdsBySide: { [player.side]: [player.playerId] },
        rowKey,
        teamId: player.teamId,
        teamName: player.teamName,
      });
      continue;
    }

    const sidePlayerIds = row.playerIdsBySide[player.side] ?? [];
    if (!sidePlayerIds.includes(player.playerId)) {
      row.playerIdsBySide[player.side] = [...sidePlayerIds, player.playerId];
    }
  }

  const rows = [...roster.values()].sort(
    (left, right) =>
      left.teamName.localeCompare(right.teamName) || left.displayName.localeCompare(right.displayName),
  );

  return (["CT", "T"] as Side[])
    .map((side) => ({
      rows: rows.filter((row) => row.displaySide === side),
      side,
    }))
    .filter((group) => group.rows.length > 0);
}

function toPositionPlayerRosterSelectionKey(playerIds: string[], side: Side) {
  const normalizedPlayerIds = [...new Set(playerIds)].sort();
  return `${side}:${normalizedPlayerIds.join("|")}`;
}
