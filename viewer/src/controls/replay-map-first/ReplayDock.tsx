import type { CSSProperties } from "react";

import type { Round, Replay } from "../../replay/types";
import type { TimelineEventItem } from "../../replay/timeline";
import { EquipmentIcon } from "../EquipmentIcon";
import { UtilityIcon } from "../UtilityIcon";

const PLAYBACK_SPEEDS = [0.5, 1, 1.5, 2];

type ReplayDockProps = {
  activeRoundIndex: number;
  currentTick: number;
  displayEndTick: number;
  displayStartTick: number;
  markers: TimelineEventItem[];
  playing: boolean;
  replay: Replay;
  round: Round;
  roundClock: string | null;
  showFreezeTime: boolean;
  speed: number;
  tickRate: number;
  onResetPlayback: () => void;
  onPlayToggle: () => void;
  onSelectRound: (index: number) => void;
  onSetSpeed: (speed: number) => void;
  onShowFreezeTimeChange: (show: boolean) => void;
  onTickChange: (tick: number) => void;
};

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
  currentTick,
  displayEndTick,
  displayStartTick,
  markers,
  playing,
  replay,
  round,
  roundClock,
  showFreezeTime,
  speed,
  tickRate,
  onResetPlayback,
  onPlayToggle,
  onSelectRound,
  onSetSpeed,
  onShowFreezeTimeChange,
  onTickChange,
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
          <div className="dr-mapfirst-time-controls" aria-label="Playback detail controls">
            <button
              aria-pressed={showFreezeTime}
              className={showFreezeTime ? "dr-mapfirst-chip dr-mapfirst-chip-active" : "dr-mapfirst-chip"}
              onClick={() => onShowFreezeTimeChange(!showFreezeTime)}
              type="button"
            >
              Freeze
            </button>
            <button className="dr-mapfirst-chip" onClick={onResetPlayback} type="button">Reset</button>
            {PLAYBACK_SPEEDS.map((entry) => (
              <button
                key={entry}
                className={entry === speed ? "dr-mapfirst-chip dr-mapfirst-chip-active" : "dr-mapfirst-chip"}
                onClick={() => onSetSpeed(entry)}
                type="button"
              >
                {entry}x
              </button>
            ))}
          </div>
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
          <div
            className="dr-mapfirst-current-needle"
            style={{ "--dr-current-percent": currentPercent } as CSSProperties}
            aria-hidden="true"
          />
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
  const marks: Array<{ key: string; label: string; percent: number }> = [];

  for (let seconds = 15; seconds <= endSeconds; seconds += 15) {
    const tick = startTick + seconds * tickRate;
    if (tick >= endTick) {
      continue;
    }

    const label = formatRulerCountdown(tick, tickRate, replay, round);
    if (label == null) {
      continue;
    }

    marks.push({
      key: `${seconds}`,
      label,
      percent: Math.min(100, Math.max(0, ((tick - startTick) / range) * 100)),
    });
  }

  return marks;
}

function formatRulerCountdown(tick: number, tickRate: number, replay: Replay, round: Round) {
  const roundTimeSeconds = replay.match.roundTimeSeconds;
  const freezeEndTick = round.freezeEndTick ?? round.startTick;

  if (roundTimeSeconds == null || !Number.isFinite(roundTimeSeconds) || roundTimeSeconds <= 0) {
    return null;
  }

  const elapsedLiveSeconds = Math.max(0, (tick - freezeEndTick) / Math.max(1, tickRate));
  return formatElapsed(Math.max(0, roundTimeSeconds - elapsedLiveSeconds));
}

function formatElapsed(seconds: number) {
  const wholeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(wholeSeconds / 60);
  const remainingSeconds = wholeSeconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}
