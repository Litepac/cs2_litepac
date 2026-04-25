import type { Side } from "../../replay/derived";
import type { HeatmapTeamFilter } from "../../replay/heatmapAnalysis";
import type { PositionsTeamFilter, PositionsView } from "../../replay/positionsAnalysis";
import type { ReplayAnalysisMode, UtilityAtlasScope, UtilityAtlasTeamFilter } from "../../replay/replayAnalysis";
import type { Round, Replay } from "../../replay/types";
import type { TimelineEventItem } from "../../replay/timeline";
import type { UtilityFocus } from "../../replay/utilityFilter";
import { EquipmentIcon } from "../EquipmentIcon";
import { UtilityIcon } from "../UtilityIcon";

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
  tickRate: number;
  utilityAtlasScope: UtilityAtlasScope;
  utilityAtlasTeamFilter: UtilityAtlasTeamFilter;
  utilityFocus: UtilityFocus;
  onHeatmapTeamFilterChange: (filter: HeatmapTeamFilter) => void;
  onPlayToggle: () => void;
  onPositionsTeamFilterChange: (filter: PositionsTeamFilter) => void;
  onSelectRound: (index: number) => void;
  onTickChange: (tick: number) => void;
  onUtilityAtlasScopeChange: (scope: UtilityAtlasScope) => void;
  onUtilityAtlasTeamFilterChange: (filter: UtilityAtlasTeamFilter) => void;
  onUtilityFocusChange: (focus: UtilityFocus) => void;
};

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

export function ReplayDock({
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
  tickRate,
  utilityAtlasScope,
  utilityAtlasTeamFilter,
  utilityFocus,
  onHeatmapTeamFilterChange,
  onPlayToggle,
  onPositionsTeamFilterChange,
  onSelectRound,
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
  const rulerMarks = buildRulerMarks(displayStartTick, displayEndTick, tickRate, replay, round);
  const showAnalysisControls = analysisMode !== "live";

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
                <Segmented items={SCOPE_OPTIONS} selectedValue={utilityAtlasScope} onChange={onUtilityAtlasScopeChange} />
                <Segmented items={TEAM_FILTERS} selectedValue={utilityAtlasTeamFilter} onChange={onUtilityAtlasTeamFilterChange} />
                <Segmented items={UTILITY_OPTIONS} selectedValue={utilityFocus} onChange={onUtilityFocusChange} />
              </>
            ) : null}
            {analysisMode === "positions" ? (
              <Segmented items={TEAM_FILTERS} selectedValue={positionsTeamFilter} onChange={onPositionsTeamFilterChange} />
            ) : null}
            {analysisMode === "heatmap" ? (
              <Segmented items={TEAM_FILTERS} selectedValue={heatmapTeamFilter} onChange={onHeatmapTeamFilterChange} />
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="dr-mapfirst-timeline-row">
        <button className="dr-mapfirst-play" onClick={onPlayToggle} type="button">
          <span
            className={playing ? "dr-mapfirst-play-icon dr-mapfirst-play-icon-pause" : "dr-mapfirst-play-icon dr-mapfirst-play-icon-play"}
            aria-hidden="true"
          />
          <span>{playing ? "Pause" : "Play"}</span>
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
            <div className="dr-mapfirst-evidence-lanes" aria-hidden="true">
              <span>Kill</span>
              <span>Utility</span>
              <span>Bomb</span>
            </div>
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
                    marker.kind === "kill" ? "dr-mapfirst-marker-lane-kill" : "",
                    marker.kind === "utility" ? "dr-mapfirst-marker-lane-utility" : "",
                    marker.kind === "bomb" ? "dr-mapfirst-marker-lane-bomb" : "",
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
    case "kill":
      return (
        <svg className="dr-mapfirst-marker-skull" viewBox="0 0 16 16" aria-hidden="true">
          <path
            className="dr-mapfirst-marker-skull-fill"
            d="M3.2 6.9C3.2 3.8 5.3 2 8 2s4.8 1.8 4.8 4.9c0 1.7-.7 3-1.8 3.8v1.2h-1v1.3H8.7v-1.3H7.3v1.3H6v-1.3H5v-1.2c-1.1-.8-1.8-2.1-1.8-3.8Z"
          />
          <path
            className="dr-mapfirst-marker-skull-cut"
            d="M5.1 6.4h2.2v2H5.1v-2Zm3.6 0h2.2v2H8.7v-2ZM7.1 9.6h1.8l.5 1.2H6.6l.5-1.2Z"
          />
        </svg>
      );
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
  const plantedMarker = markers.find((entry) => entry.presentation === "bomb-plant");
  if (!plantedMarker) {
    return null;
  }

  const terminalMarker =
    markers.find((entry) => entry.presentation === "bomb-defuse" && entry.percent >= plantedMarker.percent) ??
    markers.find((entry) => entry.presentation === "bomb-explode" && entry.percent >= plantedMarker.percent);

  const right = terminalMarker?.percent ?? 100;
  return {
    left: plantedMarker.percent,
    width: Math.max(1, right - plantedMarker.percent),
  };
}

function buildRulerMarks(startTick: number, endTick: number, tickRate: number, replay: Replay, round: Round) {
  const range = Math.max(1, endTick - startTick);
  const durationSeconds = range / Math.max(1, tickRate);
  const endSeconds = Math.floor(durationSeconds / 15) * 15;
  const marks: Array<{ key: string; label: string; percent: number }> = [{ key: "0", label: formatRulerTick(startTick, startTick, tickRate, replay, round), percent: 0 }];

  for (let seconds = 15; seconds <= endSeconds; seconds += 15) {
    const tick = startTick + seconds * tickRate;
    if (tick >= endTick) {
      continue;
    }

    marks.push({
      key: `${seconds}`,
      label: formatRulerTick(tick, startTick, tickRate, replay, round),
      percent: Math.min(100, Math.max(0, ((tick - startTick) / range) * 100)),
    });
  }

  return marks;
}

function formatRulerTick(tick: number, startTick: number, tickRate: number, replay: Replay, round: Round) {
  const freezeEndTick = round.freezeEndTick ?? round.startTick;
  const roundTimeSeconds = replay.match.roundTimeSeconds ?? null;

  if (roundTimeSeconds != null && Number.isFinite(roundTimeSeconds) && roundTimeSeconds > 0 && tick >= freezeEndTick) {
    return formatElapsed(Math.max(0, roundTimeSeconds - (tick - freezeEndTick) / Math.max(1, tickRate)));
  }

  const elapsedSeconds = Math.max(0, (tick - startTick) / Math.max(1, tickRate));
  return `${Math.round(elapsedSeconds)}s`;
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
