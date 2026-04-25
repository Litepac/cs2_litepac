import { useEffect, useMemo, useRef, useState } from "react";

import { resolveRoundTimer } from "../replay/roundTimer";
import type { Replay } from "../replay/types";
import { clampTick, resolveInitialRoundTick, resolveVisibleRoundEndTick } from "./replaySession";

export function useReplayPlayback(
  replay: Replay | null,
  round: Replay["rounds"][number] | null,
  roundIndex: number,
) {
  const [displayTick, setDisplayTick] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const frameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);

  const initialRoundTick = round ? resolveInitialRoundTick(round) : 0;
  const effectiveRoundEndTick = round ? resolveVisibleRoundEndTick(round) : 0;
  const renderTick = round ? clampTick(displayTick, round.startTick, effectiveRoundEndTick) : 0;

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
  const roundTimer = replay && round ? resolveRoundTimer(replay, round, tick) : null;
  const roundClock = roundTimer?.display ?? null;

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

  function resetPlayback() {
    setDisplayTick(initialRoundTick);
    setPlaying(false);
    lastFrameTimeRef.current = null;
  }

  function changeTick(nextTick: number) {
    setDisplayTick(nextTick);
    setPlaying(false);
    lastFrameTimeRef.current = null;
  }

  return useMemo(
    () => ({
      changeTick,
      displayTick,
      effectiveRoundEndTick,
      initialRoundTick,
      playing,
      renderTick,
      renderTickRounded,
      resetPlayback,
      roundClock,
      setSpeed,
      speed,
      tick,
      togglePlayback,
    }),
    [
      displayTick,
      effectiveRoundEndTick,
      initialRoundTick,
      playing,
      renderTick,
      renderTickRounded,
      roundClock,
      speed,
      tick,
    ],
  );
}
