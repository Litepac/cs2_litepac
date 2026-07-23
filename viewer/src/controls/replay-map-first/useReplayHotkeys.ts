import { useEffect, useRef } from "react";

import type { StageToolMode } from "./ReplayDrawingToolbar";

type UseReplayHotkeysInput = {
  clearDrawings: () => void;
  setStageToolMode: (mode: StageToolMode) => void;
  togglePlayback: () => void;
};

export function useReplayHotkeys({ clearDrawings, setStageToolMode, togglePlayback }: UseReplayHotkeysInput) {
  const clearDrawingsRef = useRef(clearDrawings);
  const setStageToolModeRef = useRef(setStageToolMode);
  const togglePlaybackRef = useRef(togglePlayback);

  useEffect(() => {
    clearDrawingsRef.current = clearDrawings;
    setStageToolModeRef.current = setStageToolMode;
    togglePlaybackRef.current = togglePlayback;
  }, [clearDrawings, setStageToolMode, togglePlayback]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === " " || event.code === "Space") {
        if (!isTextEntryKeyboardTarget(event.target)) {
          event.preventDefault();
          togglePlaybackRef.current();
        }
        return;
      }

      if (isInteractiveKeyboardTarget(event.target)) {
        return;
      }

      if (key === "c") {
        event.preventDefault();
        clearDrawingsRef.current();
        return;
      }

      if (key === "d") {
        event.preventDefault();
        setStageToolModeRef.current("draw");
        return;
      }

      if (key === "m") {
        event.preventDefault();
        setStageToolModeRef.current("move");
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

function isInteractiveKeyboardTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return (
    target.isContentEditable ||
    tagName === "button" ||
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    tagName === "a" ||
    target.closest('[role="button"], [role="slider"], input[type="range"]') != null
  );
}

function isTextEntryKeyboardTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return target.isContentEditable || tagName === "textarea" || tagName === "select" || isTextInput(target);
}

function isTextInput(target: HTMLElement) {
  if (!(target instanceof HTMLInputElement)) {
    return false;
  }

  return !["button", "checkbox", "radio", "range", "reset", "submit"].includes(target.type);
}
