import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { applyCameraTransform, resolveViewportDimensions } from "./replayStage/camera";
import { DEFAULT_STAGE_HEIGHT, DEFAULT_STAGE_WIDTH } from "./replayStage/constants";
import { attachStageInteractions } from "./replayStage/interaction";
import { createStageState, ensureStageMap, resolveStageRenderResolution } from "./replayStage/mapStage";
import { renderDynamicFrame } from "./replayStage/renderFrame";
import type { ReplayStageProps, StageState } from "./replayStage/types";

export function ReplayStage({
  activeRoundIndex,
  analysisMode,
  currentTick,
  heatmapCellSize,
  heatmapScope,
  heatmapBuckets,
  heatmapMaxSampleCount,
  livePlayerContextMode,
  deathReviewEntries,
  onSelectDeathReviewEntry,
  onSelectAtlasEntry,
  positionPlayerSnapshots,
  positionTrailEntries,
  showPositionRoundNumbers,
  positionsView,
  replay,
  round,
  selectedUtilityAtlasKey,
  selectedDeathReviewKey,
  selectedPlayerId,
  utilityAtlasEntries,
  utilityFocus,
  onSelectPositionSnapshot,
  onSelectPlayer,
}: ReplayStageProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<StageState | null>(null);
  const playerById = useMemo(() => new Map(replay.players.map((player) => [player.playerId, player])), [replay.players]);
  const currentTickRef = useRef(currentTick);
  const replayRef = useRef(replay);
  const roundRef = useRef(round);
  const playerByIdRef = useRef(playerById);
  const selectedPlayerIdRef = useRef(selectedPlayerId);
  const selectedUtilityAtlasKeyRef = useRef(selectedUtilityAtlasKey);
  const selectedDeathReviewKeyRef = useRef(selectedDeathReviewKey);
  const activeRoundIndexRef = useRef(activeRoundIndex);
  const analysisModeRef = useRef(analysisMode);
  const utilityAtlasEntriesRef = useRef(utilityAtlasEntries);
  const deathReviewEntriesRef = useRef(deathReviewEntries);
  const utilityFocusRef = useRef(utilityFocus);
  const positionPlayerSnapshotsRef = useRef(positionPlayerSnapshots);
  const positionTrailEntriesRef = useRef(positionTrailEntries);
  const positionsViewRef = useRef(positionsView);
  const showPositionRoundNumbersRef = useRef(showPositionRoundNumbers);
  const heatmapCellSizeRef = useRef(heatmapCellSize);
  const heatmapScopeRef = useRef(heatmapScope);
  const heatmapBucketsRef = useRef(heatmapBuckets);
  const heatmapMaxSampleCountRef = useRef(heatmapMaxSampleCount);
  const livePlayerContextModeRef = useRef(livePlayerContextMode);
  const onSelectPlayerRef = useRef(onSelectPlayer);
  const onSelectAtlasEntryRef = useRef(onSelectAtlasEntry);
  const onSelectDeathReviewEntryRef = useRef(onSelectDeathReviewEntry);
  const onSelectPositionSnapshotRef = useRef(onSelectPositionSnapshot);
  const renderErrorRef = useRef<string | null>(null);
  const [stageRevision, setStageRevision] = useState(0);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [viewportSize, setViewportSize] = useState({
    height: DEFAULT_STAGE_HEIGHT,
    width: DEFAULT_STAGE_WIDTH,
  });

  function syncViewportSizeFromHost(hostElement: HTMLDivElement) {
    const bounds = hostElement.getBoundingClientRect();
    const nextViewportSize = resolveViewportDimensions(bounds.width, bounds.height);
    setViewportSize((value) =>
      value.width === nextViewportSize.width && value.height === nextViewportSize.height ? value : nextViewportSize,
    );

    const stage = stageRef.current;
    if (stage) {
      const renderResolution = resolveStageRenderResolution();
      stage.app.renderer.resize(nextViewportSize.width, nextViewportSize.height, renderResolution);
      stage.currentRenderResolution = renderResolution;
      applyCameraTransform(stage);
      setStageRevision((value) => value + 1);
    }
  }

  useEffect(() => {
    currentTickRef.current = currentTick;
    replayRef.current = replay;
    roundRef.current = round;
    playerByIdRef.current = playerById;
    selectedPlayerIdRef.current = selectedPlayerId;
    selectedUtilityAtlasKeyRef.current = selectedUtilityAtlasKey;
    selectedDeathReviewKeyRef.current = selectedDeathReviewKey;
    activeRoundIndexRef.current = activeRoundIndex;
    analysisModeRef.current = analysisMode;
    positionPlayerSnapshotsRef.current = positionPlayerSnapshots;
    positionTrailEntriesRef.current = positionTrailEntries;
    positionsViewRef.current = positionsView;
    showPositionRoundNumbersRef.current = showPositionRoundNumbers;
    heatmapCellSizeRef.current = heatmapCellSize;
    heatmapScopeRef.current = heatmapScope;
    heatmapBucketsRef.current = heatmapBuckets;
    heatmapMaxSampleCountRef.current = heatmapMaxSampleCount;
    livePlayerContextModeRef.current = livePlayerContextMode;
    utilityAtlasEntriesRef.current = utilityAtlasEntries;
    deathReviewEntriesRef.current = deathReviewEntries;
    utilityFocusRef.current = utilityFocus;
    onSelectPlayerRef.current = onSelectPlayer;
    onSelectAtlasEntryRef.current = onSelectAtlasEntry;
    onSelectDeathReviewEntryRef.current = onSelectDeathReviewEntry;
    onSelectPositionSnapshotRef.current = onSelectPositionSnapshot;
  }, [activeRoundIndex, analysisMode, currentTick, deathReviewEntries, heatmapBuckets, heatmapCellSize, heatmapMaxSampleCount, heatmapScope, livePlayerContextMode, onSelectAtlasEntry, onSelectDeathReviewEntry, onSelectPlayer, onSelectPositionSnapshot, playerById, positionPlayerSnapshots, positionTrailEntries, positionsView, replay, round, selectedDeathReviewKey, selectedPlayerId, selectedUtilityAtlasKey, showPositionRoundNumbers, utilityAtlasEntries, utilityFocus]);

  useLayoutEffect(() => {
    if (!hostRef.current) {
      return;
    }

    const hostElement = hostRef.current;
    let frameA: number | null = null;
    let frameB: number | null = null;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      syncViewportSizeFromHost(hostElement);
    });
    const onWindowResize = () => syncViewportSizeFromHost(hostElement);
    const removeDevicePixelRatioWatcher = watchDevicePixelRatio(() => syncViewportSizeFromHost(hostElement));

    observer.observe(hostElement);
    window.addEventListener("resize", onWindowResize);
    window.addEventListener("focus", onWindowResize);
    window.visualViewport?.addEventListener("resize", onWindowResize);
    syncViewportSizeFromHost(hostElement);
    frameA = window.requestAnimationFrame(() => {
      syncViewportSizeFromHost(hostElement);
      frameB = window.requestAnimationFrame(() => syncViewportSizeFromHost(hostElement));
    });

    return () => {
      observer.disconnect();
      removeDevicePixelRatioWatcher();
      window.removeEventListener("resize", onWindowResize);
      window.removeEventListener("focus", onWindowResize);
      window.visualViewport?.removeEventListener("resize", onWindowResize);
      if (frameA != null) {
        window.cancelAnimationFrame(frameA);
      }
      if (frameB != null) {
        window.cancelAnimationFrame(frameB);
      }
    };
  }, []);

  useEffect(() => {
    if (!hostRef.current) {
      return;
    }

    const hostElement = hostRef.current;
    let frameA: number | null = window.requestAnimationFrame(() => syncViewportSizeFromHost(hostElement));
    let frameB: number | null = null;
    const timeoutId = window.setTimeout(() => {
      frameB = window.requestAnimationFrame(() => syncViewportSizeFromHost(hostElement));
    }, 60);

    return () => {
      if (frameA != null) {
        window.cancelAnimationFrame(frameA);
      }
      if (frameB != null) {
        window.cancelAnimationFrame(frameB);
      }
      window.clearTimeout(timeoutId);
    };
  }, [replay.sourceDemo.fileName, round.roundNumber]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!hostRef.current || stageRef.current) {
        return;
      }

      const stage = await createStageState(hostRef.current);
      if (cancelled) {
        stage.app.destroy(true, { children: true });
        return;
      }

      stageRef.current = stage;
      syncViewportSizeFromHost(hostRef.current);
      setStageRevision((value) => value + 1);
    }

    void init();

    return () => {
      cancelled = true;
      if (stageRef.current) {
        stageRef.current.app.destroy(true, { children: true });
        stageRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }

    const renderResolution = resolveStageRenderResolution();
    stage.app.renderer.resize(viewportSize.width, viewportSize.height, renderResolution);
    stage.currentRenderResolution = renderResolution;
    applyCameraTransform(stage);
    setStageRevision((value) => value + 1);
  }, [viewportSize]);

  useEffect(() => {
    if (hostRef.current == null || stageRef.current == null) {
      return;
    }

    return attachStageInteractions(hostRef.current, stageRef.current);
  }, [stageRevision]);

  useEffect(() => {
    let cancelled = false;

    async function prepareStage() {
      const stage = stageRef.current;
      if (!stage) {
        return;
      }

      try {
        await ensureStageMap(stage, replayRef.current, viewportSize.width, viewportSize.height);
        if (!cancelled) {
          setRenderError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setRenderError(error instanceof Error ? error.message : String(error));
        }
      }
    }

    void prepareStage();

    return () => {
      cancelled = true;
    };
  }, [stageRevision, viewportSize, replay.map.radarImageKey]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage?.radarViewport) {
      return;
    }

    try {
      renderDynamicFrame(
        stage,
        analysisModeRef.current,
        replayRef.current,
        roundRef.current,
        currentTickRef.current,
        selectedPlayerIdRef.current,
        selectedUtilityAtlasKeyRef.current,
        activeRoundIndexRef.current,
        heatmapCellSizeRef.current,
        heatmapScopeRef.current,
        heatmapBucketsRef.current,
        heatmapMaxSampleCountRef.current,
        livePlayerContextModeRef.current,
        deathReviewEntriesRef.current,
        selectedDeathReviewKeyRef.current,
        positionPlayerSnapshotsRef.current,
        positionTrailEntriesRef.current,
        showPositionRoundNumbersRef.current,
        positionsViewRef.current,
        utilityAtlasEntriesRef.current,
        utilityFocusRef.current,
        playerByIdRef.current,
        onSelectPlayerRef.current,
        onSelectDeathReviewEntryRef.current,
        onSelectAtlasEntryRef.current,
        onSelectPositionSnapshotRef.current,
      );
      if (renderErrorRef.current != null) {
        renderErrorRef.current = null;
        setRenderError(null);
      }
    } catch (error) {
      const nextError = error instanceof Error ? error.message : String(error);
      if (renderErrorRef.current !== nextError) {
        renderErrorRef.current = nextError;
        setRenderError(nextError);
      }
    }
  }, [activeRoundIndex, analysisMode, currentTick, deathReviewEntries, heatmapBuckets, heatmapCellSize, heatmapMaxSampleCount, heatmapScope, livePlayerContextMode, stageRevision, replay, round, selectedDeathReviewKey, selectedPlayerId, selectedUtilityAtlasKey, positionPlayerSnapshots, positionTrailEntries, positionsView, showPositionRoundNumbers, utilityAtlasEntries, utilityFocus, playerById]);

  return (
    <div className="stage-shell">
      <div className="stage" ref={hostRef} />
      {renderError ? <div className="stage-error">{renderError}</div> : null}
    </div>
  );
}

function watchDevicePixelRatio(onChange: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }

  let mediaQuery: MediaQueryList | null = null;
  let removeListener: (() => void) | null = null;

  const arm = () => {
    removeListener?.();
    const ratio = Number.isFinite(window.devicePixelRatio) ? window.devicePixelRatio || 1 : 1;
    mediaQuery = window.matchMedia(`(resolution: ${ratio}dppx)`);
    const listener = () => {
      onChange();
      arm();
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", listener);
      removeListener = () => mediaQuery?.removeEventListener("change", listener);
    } else {
      mediaQuery.addListener(listener);
      removeListener = () => mediaQuery?.removeListener(listener);
    }
  };

  arm();
  return () => {
    removeListener?.();
    mediaQuery = null;
  };
}
