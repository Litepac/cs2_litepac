import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

import { ReplayStage } from "../canvas/ReplayStage";
import { KillFeed } from "../controls/KillFeed";
import { RosterPanel } from "../controls/RosterPanel";
import { Sidebar } from "../controls/Sidebar";
import { formatRoundClock } from "../replay/derived";
import { loadFixtureIndex, type FixtureIndex } from "../replay/fixtures";
import { loadReplayFile, loadReplayURL } from "../replay/loader";
import { buildTimelineMarkers } from "../replay/timeline";
import type { Replay } from "../replay/types";
import type { UtilityFocus } from "../replay/utilityFilter";
import { TimelinePanel } from "../timeline/TimelinePanel";

export function App() {
  const [replay, setReplay] = useState<Replay | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [roundIndex, setRoundIndex] = useState(0);
  const [displayTick, setDisplayTick] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [utilityFocus, setUtilityFocus] = useState<UtilityFocus>("all");
  const [showFreezeTime, setShowFreezeTime] = useState(false);
  const [fixtures, setFixtures] = useState<FixtureIndex["files"]>([]);
  const frameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);

  const round = replay?.rounds[roundIndex] ?? null;
  const initialRoundTick = round ? resolveInitialRoundTick(round) : 0;
  const effectiveRoundEndTick = round ? resolveVisibleRoundEndTick(round) : 0;
  const renderTick = round ? clampTick(displayTick, round.startTick, round.endTick) : 0;
  const clockStartTick = round
    ? showFreezeTime
      ? round.startTick
      : clampTick(round.freezeEndTick ?? round.startTick, round.startTick, round.endTick)
    : 0;

  useEffect(() => {
    void loadFixtureIndex().then((index) => {
      setFixtures(index?.files ?? []);
    });
  }, []);

  useEffect(() => {
    if (!round) {
      return;
    }

    setDisplayTick(initialRoundTick);
    setPlaying(false);
    lastFrameTimeRef.current = null;
  }, [initialRoundTick, replay?.match.tickRate, replay?.sourceDemo.tickRate, roundIndex, round]);

  useEffect(() => {
    if (!playing || !round) {
      lastFrameTimeRef.current = null;
      return;
    }

    const tickRate = replay?.match.tickRate || replay?.sourceDemo.tickRate || 64;

    const step = (timestamp: number) => {
      const previous = lastFrameTimeRef.current ?? timestamp;
      lastFrameTimeRef.current = timestamp;
      const elapsedSeconds = Math.max(0, (timestamp - previous) / 1000);

      setDisplayTick((current) => {
        const next = Math.min(effectiveRoundEndTick, current + elapsedSeconds * tickRate * speed);
        if (next >= effectiveRoundEndTick) {
          setPlaying(false);
        }
        return next;
      });

      frameRef.current = window.requestAnimationFrame(step);
    };

    frameRef.current = window.requestAnimationFrame(step);
    return () => {
      if (frameRef.current != null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      lastFrameTimeRef.current = null;
    };
  }, [effectiveRoundEndTick, playing, replay?.match.tickRate, replay?.sourceDemo.tickRate, round, speed]);

  const tick = Math.round(displayTick);
  const renderTickRounded = Math.round(renderTick);
  const roundClock = replay && round ? formatRoundClock(tick, clockStartTick, replay.match.tickRate) : null;
  const timelineMarkers = useMemo(() => buildTimelineMarkers(replay, round, utilityFocus), [replay, round, utilityFocus]);

  function togglePlayback() {
    if (!round) {
      return;
    }

    if (playing) {
      setPlaying(false);
      return;
    }

    if (displayTick >= effectiveRoundEndTick) {
      setDisplayTick(initialRoundTick);
    }

    lastFrameTimeRef.current = null;
    setPlaying(true);
  }

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const loaded = await loadReplayFile(file);
      setReplay(loaded);
      setRoundIndex(0);
      setSelectedPlayerId(null);
      setError(null);
    } catch (loadError) {
      setReplay(null);
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    }
  }

  async function onFixtureLoad(fileName: string) {
    try {
      const loaded = await loadReplayURL(`/fixtures/${fileName}`);
      setReplay(loaded);
      setRoundIndex(0);
      setSelectedPlayerId(null);
      setError(null);
    } catch (loadError) {
      setReplay(null);
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    }
  }

  return (
    <div className="sky-shell">
      <Sidebar
        error={error}
        fixtures={fixtures}
        replay={replay}
        onFileChange={onFileChange}
        onFixtureLoad={onFixtureLoad}
      />

      <main className="viewer-shell">
        {replay && round ? (
          <>
            <section className="map-workspace">
              <div className="map-stage-frame">
                <ReplayStage
                  key={`${replay.sourceDemo.fileName}:${round.roundNumber}`}
                  currentTick={renderTick}
                  replay={replay}
                  round={round}
                  selectedPlayerId={selectedPlayerId}
                  utilityFocus={utilityFocus}
                  onSelectPlayer={setSelectedPlayerId}
                />
                <KillFeed currentTick={renderTickRounded} replay={replay} round={round} />
                <aside className="right-shell right-shell-overlay">
                  <RosterPanel
                    replay={replay}
                    round={round}
                    currentTick={renderTickRounded}
                    selectedPlayerId={selectedPlayerId}
                    onSelectPlayer={setSelectedPlayerId}
                  />
                </aside>
              </div>
            </section>

            <TimelinePanel
              activeRoundIndex={roundIndex}
              currentTick={tick}
              replay={replay}
              markers={timelineMarkers}
              playing={playing}
              roundClock={roundClock}
              round={round}
              rounds={replay.rounds}
              showFreezeTime={showFreezeTime}
              speed={speed}
              tick={tick}
              tickRate={replay.match.tickRate}
              utilityFocus={utilityFocus}
              onSelectRound={setRoundIndex}
              onPlayToggle={togglePlayback}
              onReset={() => {
                setDisplayTick(initialRoundTick);
                setPlaying(false);
                lastFrameTimeRef.current = null;
              }}
              onSpeedChange={(nextSpeed) => {
                setSpeed(nextSpeed);
              }}
              onShowFreezeTimeChange={setShowFreezeTime}
              onTickChange={(nextTick) => {
                setDisplayTick(nextTick);
                setPlaying(false);
                lastFrameTimeRef.current = null;
              }}
              onUtilityFocusChange={setUtilityFocus}
            />
          </>
        ) : (
          <section className="empty-state">
            <div className="eyebrow">Viewer</div>
            <h2>Canonical replay only</h2>
            <p>Load a validated `mastermind.replay.json` file to inspect rounds, positions, bomb flow, and utility timing.</p>
          </section>
        )}
      </main>
    </div>
  );
}

function resolveInitialRoundTick(round: NonNullable<Replay["rounds"][number]>) {
  const liveStartTick = clampTick(round.freezeEndTick ?? round.startTick, round.startTick, round.endTick);
  const searchEndTick = Math.min(round.endTick, liveStartTick + 64 * 8);
  let firstVisibleTick: number | null = null;
  let firstBalancedTick: number | null = null;
  let bestTick = Math.max(
    liveStartTick,
    Math.min(...round.playerStreams.map((stream) => stream.sampleOriginTick)),
  );
  let bestVisibleCount = -1;

  for (let tick = liveStartTick; tick <= searchEndTick; tick += 1) {
    let ctVisibleCount = 0;
    let tVisibleCount = 0;

    for (const stream of round.playerStreams) {
      const index = tick - stream.sampleOriginTick;
      if (index < 0 || index >= stream.x.length) {
        continue;
      }

      if (!stream.alive[index]) {
        continue;
      }

      if (stream.x[index] == null || stream.y[index] == null) {
        continue;
      }

      if (stream.side === "CT") {
        ctVisibleCount += 1;
      } else if (stream.side === "T") {
        tVisibleCount += 1;
      }
    }

    const visibleCount = ctVisibleCount + tVisibleCount;

    if (visibleCount > 0 && firstVisibleTick == null) {
      firstVisibleTick = tick;
    }

    if (visibleCount >= 8 && ctVisibleCount >= 3 && tVisibleCount >= 3 && firstBalancedTick == null) {
      firstBalancedTick = tick;
    }

    if (visibleCount > bestVisibleCount) {
      bestVisibleCount = visibleCount;
      bestTick = tick;
    }

    if (visibleCount >= 10 && ctVisibleCount >= 5 && tVisibleCount >= 5) {
      return tick;
    }
  }

  if (firstBalancedTick != null) {
    return firstBalancedTick;
  }

  if (firstVisibleTick != null) {
    return firstVisibleTick;
  }

  return bestTick;
}

function resolveVisibleRoundEndTick(round: NonNullable<Replay["rounds"][number]>) {
  if (round.officialEndTick != null && round.officialEndTick > round.endTick) {
    return round.officialEndTick;
  }

  return round.endTick;
}

function clampTick(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
