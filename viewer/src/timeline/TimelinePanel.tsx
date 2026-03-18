import { useEffect, useRef } from "react";

import type { UtilityFocus } from "../replay/utilityFilter";
import type { Round } from "../replay/types";
import type { TimelineEventItem, TimelineUtilityWindow } from "../replay/timeline";

type Props = {
  activeRoundIndex: number;
  currentTick: number;
  markers: TimelineEventItem[];
  playing: boolean;
  roundClock: string | null;
  round: Round;
  rounds: Round[];
  showFreezeTime: boolean;
  speed: number;
  tick: number;
  tickRate: number;
  utilityFocus: UtilityFocus;
  utilityWindows: TimelineUtilityWindow[];
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
  roundClock,
  round,
  rounds,
  showFreezeTime,
  speed,
  tick,
  tickRate,
  utilityFocus,
  utilityWindows,
  onPlayToggle,
  onReset,
  onSelectRound,
  onShowFreezeTimeChange,
  onSpeedChange,
  onTickChange,
  onUtilityFocusChange,
}: Props) {
  const displayStartTick = showFreezeTime ? round.startTick : clamp(round.freezeEndTick ?? round.startTick, round.startTick, round.endTick);
  const displayEndTick = round.endTick;
  const range = Math.max(1, displayEndTick - displayStartTick);
  const seekValue = clamp(currentTick, displayStartTick, displayEndTick);
  const currentPercent = `${((seekValue - displayStartTick) / range) * 100}%`;
  const phases = buildRoundPhases(round).filter((phase) => showFreezeTime || phase.kind !== "freeze");
  const secondMarkers = buildSecondMarkers(round, tickRate, displayStartTick);
  const visibleMarkers = markers.filter((event) => event.tick >= displayStartTick && event.tick <= displayEndTick);
  const visibleUtilityWindows = utilityWindows
    .map((window) => ({
      ...window,
      startTick: clamp(window.startTick, displayStartTick, displayEndTick),
      endTick: clamp(window.endTick, displayStartTick, displayEndTick),
    }))
    .filter((window) => window.endTick > window.startTick);
  const officialOffsetTicks =
    round.officialEndTick != null && round.officialEndTick > round.endTick ? round.officialEndTick - round.endTick : null;
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
      <div className="timeline-operator-top">
        <div className="timeline-utility-toggle-row">
          <span className="timeline-section-tag">Replay</span>
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
            <span className="timeline-readout-round">Round {round.roundNumber}</span>
            <strong>{roundClock ?? "--:--"}</strong>
            <span className="timeline-readout-tick">Tick {tick}</span>
            {round.endReason ? <span className="timeline-end-reason">{round.endReason}</span> : null}
            {officialOffsetTicks != null ? <span className="timeline-end-offset">official +{officialOffsetTicks} ticks</span> : null}
          </div>

          <div className="timeline-bands-grid">
            <span className="timeline-row-label">TIME</span>
            <div className="timeline-ruler-row timeline-operator-row">
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

            <span className="timeline-row-label">PHASE</span>
            <div className="timeline-phase-band">
              {phases.map((phase) => (
                <span
                  key={`${phase.kind}-${phase.startTick}-${phase.endTick}`}
                  className={`timeline-phase timeline-phase-${phase.kind}`}
                  style={{
                    left: `${((clamp(phase.startTick, displayStartTick, displayEndTick) - displayStartTick) / range) * 100}%`,
                    width: `${((clamp(phase.endTick, displayStartTick, displayEndTick) - clamp(phase.startTick, displayStartTick, displayEndTick)) / range) * 100}%`,
                  }}
                  title={phase.label}
                />
              ))}
              <span className="timeline-current-line" style={{ left: currentPercent }} />
            </div>

            <span className="timeline-row-label">UTIL</span>
            <div className="timeline-utility-row timeline-operator-row">
              {visibleUtilityWindows.map((utilityWindow) => (
                <span
                  key={utilityWindow.key}
                  className={`timeline-utility-window timeline-utility-window-${utilityWindow.kind}`}
                  style={{
                    left: `${((utilityWindow.startTick - displayStartTick) / range) * 100}%`,
                    width: `${((utilityWindow.endTick - utilityWindow.startTick) / range) * 100}%`,
                  }}
                  title={utilityWindow.label}
                />
              ))}
              <span className="timeline-current-line" style={{ left: currentPercent }} />
            </div>

            <span className="timeline-row-label">EVENTS</span>
            <div className="timeline-marker-row timeline-operator-row">
              {visibleMarkers.map((event) => (
                <span
                  key={event.key}
                  className={timelineMarkerClassName(event)}
                  style={{ left: `${((event.tick - displayStartTick) / range) * 100}%` }}
                  title={event.label}
                />
              ))}
              <span className="timeline-current-line" style={{ left: currentPercent }} />
            </div>

            <span className="timeline-row-label">SEEK</span>
            <div className="timeline-seek-row timeline-operator-row">
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

        <div className="timeline-right-controls">
          <button className="control-button" onClick={onReset}>Reset</button>
          <div className="timeline-speed-row">
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
        </div>
      </div>
    </section>
  );
}

function timelineMarkerClassName(event: TimelineEventItem) {
  if (event.kind === "bomb") {
    return "timeline-marker timeline-marker-bomb";
  }

  if (event.kind === "utility") {
    return `timeline-marker timeline-marker-utility timeline-marker-utility-${event.utilityKind ?? "generic"}`;
  }

  return "timeline-marker timeline-marker-kill";
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

function buildSecondMarkers(round: Round, tickRate: number, displayStartTick: number) {
  const markers: Array<{ label: string; tick: number }> = [];
  const stepTicks = Math.max(1, Math.round(tickRate * 15));

  for (let tick = displayStartTick + stepTicks; tick < round.endTick; tick += stepTicks) {
    const seconds = Math.round((tick - displayStartTick) / tickRate);
    markers.push({
      label: `${seconds}s`,
      tick,
    });
  }

  return markers;
}
