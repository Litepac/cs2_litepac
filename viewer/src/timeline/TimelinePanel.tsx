import { useEffect, useRef, type CSSProperties } from "react";

import { scoreForSide, sideTeam } from "../replay/derived";
import { normalizeUtilityVisualKind, utilityColorCss } from "../replay/utilityPresentation";
import type { UtilityFocus } from "../replay/utilityFilter";
import type { Replay, Round } from "../replay/types";
import type { TimelineEventItem } from "../replay/timeline";

type Props = {
  activeRoundIndex: number;
  currentTick: number;
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
  utilityFocus: UtilityFocus;
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
  { label: "Fire", value: "fire" },
  { label: "Decoy", value: "decoy" },
  { label: "All", value: "all" },
];

export function TimelinePanel({
  activeRoundIndex,
  currentTick,
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
  utilityFocus,
  onPlayToggle,
  onReset,
  onSelectRound,
  onShowFreezeTimeChange,
  onSpeedChange,
  onTickChange,
  onUtilityFocusChange,
}: Props) {
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
              {entry.roundNumber}
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
          <button className="timeline-play-button" onClick={onPlayToggle}>
            {playing ? "Pause" : "Play"}
          </button>
          <div className="timeline-clock-block">
            <span>speed {speed}x</span>
            <strong>{roundClock ?? "--:--"}</strong>
          </div>
        </div>

        <div className="timeline-center-dock">
          <div className="timeline-readout-row">
            <span className="timeline-map-label">{replay.map.displayName}</span>
            <span className="timeline-readout-round">Round {round.roundNumber}</span>
            <span className="timeline-readout-tick">Tick {tick}</span>
            <span className={`timeline-readout-chip timeline-readout-chip-${currentPhase.kind}`}>{currentPhase.label}</span>
            {utilityFocus !== "all" ? (
              <span className="timeline-readout-chip timeline-readout-chip-muted">{utilityFocusLabel(utilityFocus)}</span>
            ) : null}
            {round.winnerSide ? <span className={`timeline-readout-side timeline-readout-side-${round.winnerSide.toLowerCase()}`}>{round.winnerSide}</span> : null}
            {round.endReason ? <span className="timeline-readout-meta">{round.endReason}</span> : null}
            {officialOffsetTicks != null ? <span className="timeline-readout-meta">official +{officialOffsetTicks}</span> : null}
            <div className="timeline-readout-scoreboard">
              <CompactScore side="CT" score={scoreForSide(round, "CT", "before")} label={ctTeam?.displayName ?? "CT Side"} />
              <CompactScore side="T" score={scoreForSide(round, "T", "before")} label={tTeam?.displayName ?? "T Side"} />
            </div>
          </div>

          <div className="timeline-bands-layout">
            <div className="timeline-label-column">
              <span className="timeline-row-label">TIME</span>
              <span className="timeline-row-label">EVENTS</span>
              <span className="timeline-row-label">SEEK</span>
            </div>

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

          <div className="timeline-controls-panel">
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
            <div className="timeline-controls-secondary">
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

function utilityFocusLabel(focus: UtilityFocus) {
  switch (focus) {
    case "flashbang":
      return "flash";
    case "hegrenade":
      return "he";
    default:
      return focus;
  }
}
