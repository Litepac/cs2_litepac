import { useEffect, useRef, type CSSProperties } from "react";

import { scoreForSide, sideTeam } from "../replay/derived";
import type { HeatmapScope, HeatmapSnapshot } from "../replay/heatmapAnalysis";
import type { PositionPlayerSnapshot, PositionTrailEntry, PositionsTeamFilter, PositionsView } from "../replay/positionsAnalysis";
import type { ReplayAnalysisMode, UtilityAtlasEntry } from "../replay/replayAnalysis";
import { normalizeUtilityVisualKind, utilityColorCss } from "../replay/utilityPresentation";
import type { UtilityFocus } from "../replay/utilityFilter";
import type { Replay, Round } from "../replay/types";
import type { TimelineEventItem } from "../replay/timeline";

type Props = {
  activeRoundIndex: number;
  analysisMode: ReplayAnalysisMode;
  currentTick: number;
  heatmapLabel: string;
  heatmapScope: HeatmapScope;
  heatmapSnapshot: HeatmapSnapshot;
  markers: TimelineEventItem[];
  playing: boolean;
  replay: Replay;
  roundClock: string | null;
  round: Round;
  rounds: Round[];
  showFreezeTime: boolean;
  speed: number;
  tick: number;
  tickRate: number;
  positionPlayerSnapshots: PositionPlayerSnapshot[];
  positionTrailEntries: PositionTrailEntry[];
  positionsLabel: string;
  positionsTeamFilter: PositionsTeamFilter;
  positionsView: PositionsView;
  utilityAtlasEntries: UtilityAtlasEntry[];
  utilityAtlasLabel: string;
  utilityFocus: UtilityFocus;
  selectedPlayerId: string | null;
  onPlayToggle: () => void;
  onReset: () => void;
  onSelectRound: (index: number) => void;
  onShowFreezeTimeChange: (show: boolean) => void;
  onSpeedChange: (speed: number) => void;
  onTickChange: (tick: number) => void;
  onUtilityFocusChange: (focus: UtilityFocus) => void;
};

const SPEEDS = [0.5, 1, 2];
const UTILITY_OPTIONS: Array<{ label: string; value: UtilityFocus }> = [
  { label: "Smoke", value: "smoke" },
  { label: "Flash", value: "flashbang" },
  { label: "HE", value: "hegrenade" },
  { label: "Molotov", value: "fire" },
  { label: "Decoy", value: "decoy" },
  { label: "All", value: "all" },
];

export function TimelinePanel({
  activeRoundIndex,
  analysisMode,
  currentTick,
  heatmapLabel,
  heatmapScope,
  heatmapSnapshot,
  markers,
  playing,
  replay,
  roundClock,
  round,
  rounds,
  showFreezeTime,
  speed,
  tick,
  tickRate,
  positionPlayerSnapshots,
  positionTrailEntries,
  positionsLabel,
  positionsTeamFilter,
  positionsView,
  utilityAtlasEntries,
  utilityAtlasLabel,
  utilityFocus,
  selectedPlayerId,
  onPlayToggle,
  onReset,
  onSelectRound,
  onShowFreezeTimeChange,
  onSpeedChange,
  onTickChange,
  onUtilityFocusChange,
}: Props) {
  const displayedRoundNumber = activeRoundIndex + 1;
  const displayStartTick = showFreezeTime ? round.startTick : clamp(round.freezeEndTick ?? round.startTick, round.startTick, round.endTick);
  const displayEndTick =
    round.officialEndTick != null && round.officialEndTick > round.endTick ? round.officialEndTick : round.endTick;
  const range = Math.max(1, displayEndTick - displayStartTick);
  const seekValue = clamp(currentTick, displayStartTick, displayEndTick);
  const currentPercent = `${((seekValue - displayStartTick) / range) * 100}%`;
  const phases = buildRoundPhases(round).filter((phase) => showFreezeTime || phase.kind !== "freeze");
  const secondMarkers = buildSecondMarkers(displayStartTick, displayEndTick, tickRate);
  const visibleMarkers = markers.filter((event) => event.tick >= displayStartTick && event.tick <= displayEndTick);
  const officialOffsetTicks =
    round.officialEndTick != null && round.officialEndTick > round.endTick ? round.officialEndTick - round.endTick : null;
  const ctTeam = sideTeam(replay, round, "CT");
  const tTeam = sideTeam(replay, round, "T");
  const currentPhase = resolveCurrentPhase(phases, seekValue);
  const atlasMode = analysisMode === "utilityAtlas";
  const positionsMode = analysisMode === "positions";
  const heatmapMode = analysisMode === "heatmap";
  const analysisModeActive = atlasMode || positionsMode || heatmapMode;
  const useReplayTransport = !analysisModeActive || positionsMode;
  const atlasRoundCount = new Set(utilityAtlasEntries.map((entry) => entry.roundIndex)).size;
  const atlasSelectedCount = selectedPlayerId
    ? utilityAtlasEntries.filter((entry) => entry.throwerPlayerId === selectedPlayerId).length
    : 0;
  const positionsRoundCount = new Set(positionTrailEntries.flatMap((entry) => entry.segments.map((segment) => segment.roundIndex))).size;
  const positionsPlayerCount = new Set(positionTrailEntries.map((entry) => entry.playerId)).size;
  const positionsSnapshotCount = positionPlayerSnapshots.length;
  const heatmapBucketCount = heatmapSnapshot.buckets.length;
  const analysisDescriptor = analysisModeActive
    ? resolveAnalysisDescriptor({
        analysisMode,
        heatmapBucketCount,
        heatmapLabel,
        heatmapScope,
        heatmapSnapshot,
        positionsLabel,
        positionsSnapshotCount,
        positionsTeamFilter,
        positionsPlayerCount,
        positionsRoundCount,
        positionsView,
        roundClock,
        selectedPlayerId,
        utilityAtlasEntries,
        utilityAtlasLabel,
        utilityAtlasRoundCount: atlasRoundCount,
        utilityAtlasSelectedCount: atlasSelectedCount,
      })
    : null;
  const rowRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    const activeButton = buttonRefs.current[activeRoundIndex];
    if (!activeButton) {
      return;
    }

    activeButton.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [activeRoundIndex]);

  return (
    <section className="timeline-shell timeline-shell-operator">
      <div className="timeline-round-nav">
        <button
          className="timeline-chevron"
          disabled={activeRoundIndex <= 0}
          onClick={() => onSelectRound(Math.max(0, activeRoundIndex - 1))}
        >
          {"<"}
        </button>
        <div className="timeline-round-strip" ref={rowRef}>
          {rounds.map((entry, index) => (
            <button
              key={entry.roundNumber}
              ref={(element) => {
                buttonRefs.current[index] = element;
              }}
              className={[
                "timeline-round-chip",
                index === activeRoundIndex ? "timeline-round-chip-active" : "",
                entry.winnerSide === "CT" ? "timeline-round-chip-ct" : "",
                entry.winnerSide === "T" ? "timeline-round-chip-t" : "",
              ].filter(Boolean).join(" ")}
              onClick={() => onSelectRound(index)}
            >
              {index + 1}
            </button>
          ))}
        </div>
        <button
          className="timeline-chevron"
          disabled={activeRoundIndex >= rounds.length - 1}
          onClick={() => onSelectRound(Math.min(rounds.length - 1, activeRoundIndex + 1))}
        >
          {">"}
        </button>
      </div>

      <div className="timeline-main-dock">
        <div className="timeline-left-controls">
          {analysisDescriptor && !positionsMode ? (
            <div className="timeline-atlas-summary">
              <span>{analysisDescriptor.title}</span>
              <strong>{analysisDescriptor.label}</strong>
              <small>{analysisDescriptor.summary}</small>
            </div>
          ) : (
            <>
              <button className="timeline-play-button" onClick={onPlayToggle}>
                {playing ? "Pause" : "Play"}
              </button>
              <div className="timeline-clock-block">
                <span>
                  Round {displayedRoundNumber} - Tick {tick}
                </span>
                <strong>{roundClock ?? "--:--"}</strong>
              </div>
            </>
          )}
        </div>

        <div className="timeline-center-dock">
          {!useReplayTransport ? (
            <div className="timeline-transport-row timeline-transport-row-atlas">
              <div className="timeline-track-shell timeline-track-shell-atlas">
                <div className="timeline-atlas-context">
                  <span className="timeline-atlas-context-label">Scope</span>
                  <strong>{analysisDescriptor?.label}</strong>
                  <small>{analysisDescriptor?.context}</small>
                </div>
              </div>
            </div>
          ) : (
            <div className="timeline-transport-row">
              <div className="timeline-track-shell">
                <div className="timeline-guide-layer" aria-hidden="true">
                  {secondMarkers.map((marker) => (
                    <span
                      key={`guide-${marker.tick}`}
                      className="timeline-guide-line"
                      style={{ left: `${((marker.tick - displayStartTick) / range) * 100}%` }}
                    />
                  ))}
                </div>

                <div className="timeline-ruler-row timeline-track-lane">
                  {secondMarkers.map((marker) => (
                    <span
                      key={marker.tick}
                      className="timeline-ruler-marker"
                      style={{ left: `${((marker.tick - displayStartTick) / range) * 100}%` }}
                    >
                      <span className="timeline-ruler-line" />
                      <span className="timeline-ruler-label">{marker.label}</span>
                    </span>
                  ))}
                  <span className="timeline-current-line" style={{ left: currentPercent }} />
                </div>

                <div className="timeline-marker-row timeline-track-lane">
                  {visibleMarkers.map((event) => (
                    <span
                      key={event.key}
                      className={timelineMarkerClassName(event)}
                      style={timelineMarkerStyle(event, displayStartTick, range)}
                      title={event.label}
                    />
                  ))}
                  <span className="timeline-current-line" style={{ left: currentPercent }} />
                </div>

                <div className="timeline-seek-row timeline-track-lane">
                  <input
                    type="range"
                    min={displayStartTick}
                    max={displayEndTick}
                    value={seekValue}
                    onChange={(event) => onTickChange(Number(event.target.value))}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="timeline-controls-panel">
            <div className="timeline-context-strip">
              <span className="timeline-map-label">{replay.map.displayName}</span>
              <span className={analysisModeActive ? "timeline-readout-chip timeline-readout-chip-live" : `timeline-readout-chip timeline-readout-chip-${currentPhase.kind}`}>
                {analysisDescriptor?.title ?? currentPhase.label}
              </span>
              {analysisModeActive ? (
                <>
                  <span className="timeline-readout-meta">{analysisDescriptor?.meta}</span>
                  <span className="timeline-readout-meta">{analysisDescriptor?.label}</span>
                </>
              ) : (
                <>
                  {round.winnerSide ? (
                    <span className={`timeline-readout-side timeline-readout-side-${round.winnerSide.toLowerCase()}`}>
                      {round.winnerSide}
                    </span>
                  ) : null}
                  {round.endReason ? <span className="timeline-readout-meta">{round.endReason}</span> : null}
                  {officialOffsetTicks != null ? <span className="timeline-readout-meta">official +{officialOffsetTicks}</span> : null}
                </>
              )}
            </div>

            <div className="timeline-controls-secondary">
              {!analysisModeActive ? (
                <div className="timeline-segmented-row timeline-utility-toggle-row">
                  <button
                    className={showFreezeTime ? "control-button control-button-active" : "control-button"}
                    onClick={() => onShowFreezeTimeChange(!showFreezeTime)}
                  >
                    Freeze
                  </button>
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
              ) : null}

              <div className="timeline-controls-inline">
                <div className="timeline-readout-scoreboard">
                  <CompactScore side="CT" score={scoreForSide(round, "CT", "before")} label={ctTeam?.displayName ?? "CT Side"} />
                  <CompactScore side="T" score={scoreForSide(round, "T", "before")} label={tTeam?.displayName ?? "T Side"} />
                </div>

                {useReplayTransport ? (
                  <>
                    <button className="timeline-play-button timeline-play-button-inline" onClick={onPlayToggle}>
                      {playing ? "Pause" : "Play"}
                    </button>
                    <div className="timeline-segmented-row timeline-segmented-row-speed">
                      {SPEEDS.map((entry) => (
                        <button
                          key={entry}
                          className={entry === speed ? "control-button control-button-active" : "control-button"}
                          onClick={() => onSpeedChange(entry)}
                        >
                          {entry}x
                        </button>
                      ))}
                    </div>
                    <button className="control-button timeline-reset-button" onClick={onReset}>
                      Reset
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

type CompactScoreProps = {
  label: string;
  score: number;
  side: "CT" | "T";
};

function CompactScore({ label, score, side }: CompactScoreProps) {
  return (
    <div className={`timeline-score-chip timeline-score-chip-${side.toLowerCase()}`}>
      <span>{side}</span>
      <strong>{score}</strong>
      <small>{label}</small>
    </div>
  );
}

function timelineMarkerClassName(event: TimelineEventItem) {
  if (event.kind === "bomb") {
    return `timeline-marker timeline-marker-bomb timeline-marker-bomb-${event.bombType ?? "generic"}`;
  }

  if (event.kind === "utility") {
    return "timeline-marker timeline-marker-utility";
  }

  return "timeline-marker timeline-marker-kill";
}

function timelineMarkerStyle(
  event: TimelineEventItem,
  displayStartTick: number,
  range: number,
): CSSProperties {
  const left = `${((event.tick - displayStartTick) / range) * 100}%`;
  if (event.kind !== "utility" || !event.utilityKind) {
    return { left };
  }

  const utilityKind = normalizeUtilityVisualKind(event.utilityKind);
  if (!utilityKind) {
    return { left };
  }

  return {
    left,
    backgroundColor: utilityColorCss(utilityKind),
  };
}

type RoundPhase = {
  endTick: number;
  kind: "freeze" | "live" | "postplant";
  label: string;
  startTick: number;
};

function buildRoundPhases(round: Round): RoundPhase[] {
  const phases: RoundPhase[] = [];
  const roundStart = round.startTick;
  const roundEnd = round.endTick;
  const freezeEnd = clamp(round.freezeEndTick ?? roundStart, roundStart, roundEnd);
  const plantedTick = round.bombEvents
    .filter((event) => event.type === "planted")
    .sort((left, right) => left.tick - right.tick)[0]?.tick ?? null;

  if (freezeEnd > roundStart) {
    phases.push({
      endTick: freezeEnd,
      kind: "freeze",
      label: "Freeze",
      startTick: roundStart,
    });
  }

  const liveStart = freezeEnd > roundStart ? freezeEnd : roundStart;
  const liveEnd = plantedTick != null ? clamp(plantedTick, liveStart, roundEnd) : roundEnd;
  if (liveEnd > liveStart) {
    phases.push({
      endTick: liveEnd,
      kind: "live",
      label: "Live",
      startTick: liveStart,
    });
  }

  if (plantedTick != null && roundEnd > plantedTick) {
    phases.push({
      endTick: roundEnd,
      kind: "postplant",
      label: "Post-plant",
      startTick: plantedTick,
    });
  }

  return phases;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function buildSecondMarkers(displayStartTick: number, displayEndTick: number, tickRate: number) {
  const markers: Array<{ label: string; tick: number }> = [];
  const stepTicks = Math.max(1, Math.round(tickRate * 15));

  for (let tick = displayStartTick + stepTicks; tick < displayEndTick; tick += stepTicks) {
    const seconds = Math.round((tick - displayStartTick) / tickRate);
    markers.push({
      label: `${seconds}s`,
      tick,
    });
  }

  return markers;
}

function resolveCurrentPhase(phases: RoundPhase[], tick: number) {
  const phase = phases.find((entry) => tick >= entry.startTick && tick <= entry.endTick) ?? phases[phases.length - 1];
  return phase ?? { kind: "live", label: "Live", startTick: tick, endTick: tick };
}

type AnalysisDescriptorInput = {
  analysisMode: ReplayAnalysisMode;
  heatmapBucketCount: number;
  heatmapLabel: string;
  heatmapScope: HeatmapScope;
  heatmapSnapshot: HeatmapSnapshot;
  positionsLabel: string;
  positionsSnapshotCount: number;
  positionsTeamFilter: PositionsTeamFilter;
  positionsPlayerCount: number;
  positionsRoundCount: number;
  positionsView: PositionsView;
  roundClock: string | null;
  selectedPlayerId: string | null;
  utilityAtlasEntries: UtilityAtlasEntry[];
  utilityAtlasLabel: string;
  utilityAtlasRoundCount: number;
  utilityAtlasSelectedCount: number;
};

type AnalysisDescriptor = {
  context: string;
  label: string;
  meta: string;
  summary: string;
  title: string;
};

function resolveAnalysisDescriptor({
  analysisMode,
  heatmapBucketCount,
  heatmapLabel,
  heatmapScope,
  heatmapSnapshot,
  positionsLabel,
  positionsSnapshotCount,
  positionsTeamFilter,
  positionsPlayerCount,
  positionsRoundCount,
  positionsView,
  roundClock,
  selectedPlayerId,
  utilityAtlasEntries,
  utilityAtlasLabel,
  utilityAtlasRoundCount,
  utilityAtlasSelectedCount,
}: AnalysisDescriptorInput): AnalysisDescriptor {
  if (analysisMode === "utilityAtlas") {
    const roundCountLabel = `${utilityAtlasRoundCount} round${utilityAtlasRoundCount === 1 ? "" : "s"}`;
    return {
      context: "Parser-backed impact surfaces rendered outside the live tick loop.",
      label: utilityAtlasLabel,
      meta: `${utilityAtlasEntries.length} throws`,
      summary: `${utilityAtlasEntries.length} throws across ${roundCountLabel}${selectedPlayerId ? ` - ${utilityAtlasSelectedCount} by selected` : ""}`,
      title: "Utility Atlas",
    };
  }

  if (analysisMode === "heatmap") {
    const roundCountLabel = `${heatmapSnapshot.roundCount} round${heatmapSnapshot.roundCount === 1 ? "" : "s"}`;
    const selected = selectedPlayerId != null;
    const occupancyLabel = selected ? "hotspot" : "occupancy";
    return {
      context: selected
        ? "Selected-player movement hotspots sampled after freeze time across the selected replay scope."
        : "All-player presence sampled after freeze time across the selected replay scope.",
      label: heatmapLabel,
      meta: `${heatmapSnapshot.playerCount} players`,
      summary: `${heatmapBucketCount} ${occupancyLabel} cells from ${heatmapSnapshot.sampleCount} samples across ${roundCountLabel}${selected ? " - player hotspots" : ""}`,
      title: selected ? "Player Heatmap" : "Occupancy",
    };
  }

  const roundCountLabel = `${positionsRoundCount} round${positionsRoundCount === 1 ? "" : "s"}`;
  const positionsPlayerScopeLabel =
    positionsTeamFilter === "CT" ? "CT" : positionsTeamFilter === "T" ? "T" : "All";
  return {
    context:
      positionsView === "player"
        ? "Selected-player replay tokens aligned to the same moment from the main replay timeline across all matching rounds."
        : "Alive player routes sampled after freeze time across the selected replay scope.",
    label: positionsView === "player" ? `${positionsPlayerScopeLabel} · ${roundClock ?? "--:--"}` : positionsLabel,
    meta: positionsView === "player" ? "player snapshot" : `${positionsPlayerCount} players`,
    summary:
      positionsView === "player"
        ? `${selectedPlayerId ? "Selected player" : "All players"} across ${positionsPlayerScopeLabel.toLowerCase()} rounds · ${positionsSnapshotCount} visible snapshots`
        : `${positionsPlayerCount} player${positionsPlayerCount === 1 ? "" : "s"} across ${roundCountLabel}${selectedPlayerId ? " - selected focus" : ""}`,
    title: "Positions",
  };
}
