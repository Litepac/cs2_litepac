import { Container } from "pixi.js";

import type { HeatmapBucket, HeatmapScope } from "../../replay/heatmapAnalysis";
import type { DeathReviewEntry } from "../../replay/deathReview";
import type { PositionPlayerSnapshot, PositionTrailEntry } from "../../replay/positionsAnalysis";
import type { ReplayAnalysisMode, UtilityAtlasEntry } from "../../replay/replayAnalysis";
import type { Replay, Round } from "../../replay/types";
import { drawDeathReviewMarker } from "../deathReviewVisuals";
import { buildHeatmapVisualCells, drawHeatmapCellVisual } from "../heatmapVisuals";
import { utilityMatchesFocus, type UtilityFocus } from "../../replay/utilityFilter";
import { utilityActivationTick, utilityLifecycleEndTick, utilitySceneStateAtTick } from "../../replay/utility";
import { drawPositionPlayerSnapshotVisual, drawPositionTrailVisual } from "../positionsVisuals";
import { drawUtilityAtlasVisual, drawUtilityVisual } from "../utilityVisuals";
import { clearLayer, showLayerWhenPopulated } from "./layers";
import { renderBombOverlays } from "./renderBombs";
import { renderCombatOverlays } from "./renderEvents";
import { renderPlayers } from "./renderPlayers";
import type { StageState } from "./types";

export type StageRenderContext = {
  activeRoundIndex: number;
  analysisMode: ReplayAnalysisMode;
  callbacks: {
    onSelectAtlasEntry?: (entry: UtilityAtlasEntry) => void;
    onSelectDeathReviewEntry?: (entry: DeathReviewEntry) => void;
    onSelectPlayer: (playerId: string) => void;
    onSelectPositionSnapshot?: (snapshot: PositionPlayerSnapshot) => void;
  };
  currentTick: number;
  deathReviewEntries: DeathReviewEntry[];
  heatmap: {
    buckets: HeatmapBucket[];
    cellSize: number;
    maxSampleCount: number;
    scope: HeatmapScope;
  };
  livePlayerContextMode: boolean;
  playerById: Map<string, Replay["players"][number]>;
  positionPlayerSnapshots: PositionPlayerSnapshot[];
  positionTrailEntries: PositionTrailEntry[];
  positionsView: "paths" | "player";
  replay: Replay;
  round: Round;
  selectedDeathReviewKey: string | null;
  selectedPlayerId: string | null;
  selectedUtilityAtlasKey: string | null;
  showPositionRoundNumbers: boolean;
  utilityAtlasEntries: UtilityAtlasEntry[];
  utilityFocus: UtilityFocus;
};

export function renderDynamicFrame(stage: StageState, context: StageRenderContext) {
  const {
    activeRoundIndex,
    analysisMode,
    callbacks,
    currentTick,
    deathReviewEntries,
    heatmap,
    livePlayerContextMode,
    playerById,
    positionPlayerSnapshots,
    positionTrailEntries,
    positionsView,
    replay,
    round,
    selectedDeathReviewKey,
    selectedPlayerId,
    selectedUtilityAtlasKey,
    showPositionRoundNumbers,
    utilityAtlasEntries,
    utilityFocus,
  } = context;
  const radarViewport = stage.radarViewport;
  if (!radarViewport) {
    return;
  }

  const tickRate = replay.match.tickRate || replay.sourceDemo.tickRate || 64;
  const fullRenderTick = Math.round(currentTick);
  const utilityRenderKey = [
    analysisMode,
    round.roundNumber,
    fullRenderTick,
    utilityFocus,
    radarViewport.viewportWidth,
    radarViewport.viewportHeight,
    selectedDeathReviewKey ?? "",
    selectedUtilityAtlasKey ?? "",
  ].join(":");
  const needsUtilityRender = stage.lastUtilityRenderKey !== utilityRenderKey;
  const needsFullRender =
    stage.lastFullRenderTick !== fullRenderTick ||
    stage.lastRoundNumber !== round.roundNumber ||
    stage.lastSelectedPlayerId !== selectedPlayerId;

  if (analysisMode === "utilityAtlas") {
    if (!needsUtilityRender) {
      return;
    }
    clearLiveUtilityContainers(stage);
    clearDeathReviewLayer(stage);
    clearLayer(stage.utilityTrailLayer);
    stage.utilityTrailLayer.visible = false;
    clearLayer(stage.utilityOverlayLayer);
    clearLayer(stage.trailLayer);
    stage.trailLayer.visible = false;
    clearLayer(stage.playerLayer);
    clearLayer(stage.bombLayer);
    clearLayer(stage.killLayer);
    clearLayer(stage.eventLayer);
    stage.lastFullRenderTick = null;
    stage.lastRoundNumber = null;
    stage.lastSelectedPlayerId = null;
    stage.lastAtlasEntryKey = null;

    const sortedAtlasEntries = selectedUtilityAtlasKey
      ? [...utilityAtlasEntries].sort((left, right) => {
          if (left.key === selectedUtilityAtlasKey) {
            return 1;
          }
          if (right.key === selectedUtilityAtlasKey) {
            return -1;
          }
          return 0;
        })
      : utilityAtlasEntries;

    for (const entry of sortedAtlasEntries) {
      const emphasize = selectedUtilityAtlasKey === entry.key;
      drawUtilityAtlasVisual(
        stage.utilityTrailLayer,
        stage.utilityOverlayLayer,
        replay,
        entry.utility,
        entry.throwerSide,
        radarViewport,
        {
          emphasize,
        },
        callbacks.onSelectAtlasEntry ? () => callbacks.onSelectAtlasEntry?.(entry) : undefined,
      );
    }

    showLayerWhenPopulated(stage.utilityTrailLayer);
    stage.lastUtilityRenderKey = utilityRenderKey;
    return;
  }

  if (analysisMode === "positions") {
    if (!needsUtilityRender) {
      return;
    }
    clearLiveUtilityContainers(stage);
    clearDeathReviewLayer(stage);
    clearLayer(stage.utilityTrailLayer);
    stage.utilityTrailLayer.visible = false;
    clearLayer(stage.utilityOverlayLayer);
    clearLayer(stage.trailLayer);
    stage.trailLayer.visible = false;
    clearLayer(stage.playerLayer);
    clearLayer(stage.bombLayer);
    clearLayer(stage.killLayer);
    clearLayer(stage.eventLayer);
    stage.lastFullRenderTick = null;
    stage.lastRoundNumber = null;
    stage.lastSelectedPlayerId = null;
    stage.lastAtlasEntryKey = null;

    if (positionsView === "paths") {
      for (const entry of positionTrailEntries) {
        drawPositionTrailVisual(
          stage.trailLayer,
          stage.utilityOverlayLayer,
          replay,
          entry,
          radarViewport,
          {
            emphasize: selectedPlayerId != null && entry.playerId === selectedPlayerId,
            hasSelectedPlayer: selectedPlayerId != null,
            markerMode: "none",
            showEndpoints: false,
          },
        );
      }
    }

    if (positionsView === "player") {
      const orderedSnapshots = [...positionPlayerSnapshots].sort((left, right) => {
        const leftActive = left.roundIndex === activeRoundIndex;
        const rightActive = right.roundIndex === activeRoundIndex;
        if (leftActive !== rightActive) {
          return leftActive ? 1 : -1;
        }
        return left.roundNumber - right.roundNumber;
      });

      for (const snapshot of orderedSnapshots) {
        drawPositionPlayerSnapshotVisual(stage.utilityOverlayLayer, replay, snapshot, radarViewport, {
          active: snapshot.roundIndex === activeRoundIndex,
          onSelectSnapshot: callbacks.onSelectPositionSnapshot,
          selectedPlayerFocus: selectedPlayerId != null,
          showRoundNumber: showPositionRoundNumbers,
        });
      }
    }

    showLayerWhenPopulated(stage.trailLayer);
    stage.lastUtilityRenderKey = utilityRenderKey;
    return;
  }

  if (analysisMode === "heatmap") {
    if (!needsUtilityRender) {
      return;
    }
    clearLiveUtilityContainers(stage);
    clearDeathReviewLayer(stage);
    clearLayer(stage.utilityTrailLayer);
    stage.utilityTrailLayer.visible = false;
    clearLayer(stage.utilityOverlayLayer);
    clearLayer(stage.trailLayer);
    stage.trailLayer.visible = false;
    clearLayer(stage.playerLayer);
    clearLayer(stage.bombLayer);
    clearLayer(stage.killLayer);
    clearLayer(stage.eventLayer);
    stage.lastFullRenderTick = null;
    stage.lastRoundNumber = null;
    stage.lastSelectedPlayerId = null;
    stage.lastAtlasEntryKey = null;

    const visualCells = buildHeatmapVisualCells(
      replay,
      {
        buckets: heatmap.buckets,
        cellSize: heatmap.cellSize,
        maxSampleCount: heatmap.maxSampleCount,
        scope: heatmap.scope,
      },
      selectedPlayerId != null,
    );

    for (const cell of visualCells) {
      drawHeatmapCellVisual(stage.trailLayer, replay, cell, radarViewport);
    }

    showLayerWhenPopulated(stage.trailLayer);
    stage.lastUtilityRenderKey = utilityRenderKey;
    return;
  }

  clearLayer(stage.trailLayer);
  stage.trailLayer.visible = false;
  if (analysisMode !== "deathReview") {
    clearDeathReviewLayer(stage);
  }

  if (needsFullRender) {
    clearLayer(stage.playerLayer);
    clearLayer(stage.bombLayer);
    clearLayer(stage.killLayer);
    clearLayer(stage.eventLayer);
  }

  if (needsUtilityRender) {
    renderLiveUtilityContainers(stage, context, fullRenderTick, tickRate);
    stage.lastUtilityRenderKey = utilityRenderKey;
  }

  if (!needsFullRender) {
    renderDeathReviewLayer(stage, context);
    return;
  }

  stage.lastFullRenderTick = fullRenderTick;
  stage.lastRoundNumber = round.roundNumber;
  stage.lastSelectedPlayerId = selectedPlayerId;

  renderBombOverlays(
    stage.bombLayer,
    replay,
    round,
    fullRenderTick,
    radarViewport,
    stage.bombDamageField,
  );
  renderCombatOverlays(stage.killLayer, replay, round, fullRenderTick, radarViewport);
  renderPlayers(
    stage.playerLayer,
    stage.eventLayer,
    replay,
    round,
    fullRenderTick,
    radarViewport,
    selectedPlayerId,
    livePlayerContextMode,
    playerById,
    callbacks.onSelectPlayer,
  );

  renderDeathReviewLayer(stage, context);
}

function resolveUtilityThrowerSide(round: Round, throwerPlayerId: string | null) {
  if (!throwerPlayerId) {
    return null;
  }

  return round.playerStreams.find((stream) => stream.playerId === throwerPlayerId)?.side ?? null;
}

function renderDeathReviewMarkers(
  layer: StageState["deathReviewLayer"],
  replay: Replay,
  entries: DeathReviewEntry[],
  radarViewport: NonNullable<StageState["radarViewport"]>,
  selectedKey: string | null,
  onSelect: (entry: DeathReviewEntry) => void,
) {
  const orderedEntries = selectedKey
    ? [...entries].sort((left, right) => {
        if (left.key === selectedKey) {
          return 1;
        }
        if (right.key === selectedKey) {
          return -1;
        }
        return 0;
      })
    : entries;

  for (const entry of orderedEntries) {
    drawDeathReviewMarker(layer, replay, entry, radarViewport, entry.key === selectedKey, onSelect);
  }
}

function renderLiveUtilityContainers(stage: StageState, context: StageRenderContext, fullRenderTick: number, tickRate: number) {
  const radarViewport = stage.radarViewport;
  if (!radarViewport) {
    return;
  }

  const activeUtilityIds = new Set<string>();
  for (const utility of context.round.utilityEntities) {
    if (!utilityMatchesFocus(utility.kind, context.utilityFocus)) {
      continue;
    }

    if (!utilitySceneStateAtTick(utility, fullRenderTick, tickRate)) {
      continue;
    }

    activeUtilityIds.add(utility.utilityId);
    const visualTick = resolveLiveUtilityVisualTick(utility, fullRenderTick, tickRate);
    const renderKey = [
      context.round.roundNumber,
      utility.utilityId,
      visualTick,
      context.utilityFocus,
      radarViewport.viewportWidth,
      radarViewport.viewportHeight,
      "unclipped-live",
    ].join(":");

    let containers = stage.liveUtilityContainers.get(utility.utilityId);
    if (!containers) {
      containers = {
        overlay: new Container(),
        renderKey: "",
        trail: new Container(),
      };
      stage.liveUtilityContainers.set(utility.utilityId, containers);
      stage.utilityTrailLayer.addChild(containers.trail);
      stage.utilityOverlayLayer.addChild(containers.overlay);
    }

    if (containers.renderKey === renderKey) {
      continue;
    }

    clearLayer(containers.trail);
    clearLayer(containers.overlay);
    drawUtilityVisual(
      containers.trail,
      containers.overlay,
      context.replay,
      utility,
      resolveUtilityThrowerSide(context.round, utility.throwerPlayerId),
      context.playerById.get(utility.throwerPlayerId ?? "")?.displayName ?? null,
      visualTick,
      radarViewport,
      tickRate,
      null,
    );
    containers.renderKey = renderKey;

    if (containers.trail.children.length === 0 && containers.overlay.children.length === 0) {
      destroyLiveUtilityContainer(stage, utility.utilityId);
    }
  }

  for (const utilityId of [...stage.liveUtilityContainers.keys()]) {
    if (!activeUtilityIds.has(utilityId)) {
      destroyLiveUtilityContainer(stage, utilityId);
    }
  }

  showLayerWhenPopulated(stage.utilityTrailLayer);
}

function resolveLiveUtilityVisualTick(utility: Round["utilityEntities"][number], fullRenderTick: number, tickRate: number) {
  const activationTick = utilityActivationTick(utility);
  if (activationTick == null || fullRenderTick < activationTick) {
    return fullRenderTick;
  }

  if (utility.kind !== "smoke" && utility.kind !== "molotov" && utility.kind !== "incendiary" && utility.kind !== "decoy") {
    return fullRenderTick;
  }

  const visualStepTicks = Math.max(1, Math.round(Math.max(1, tickRate) / 32));
  return Math.floor(fullRenderTick / visualStepTicks) * visualStepTicks;
}

function renderDeathReviewLayer(stage: StageState, context: StageRenderContext) {
  const radarViewport = stage.radarViewport;
  const onSelect = context.callbacks.onSelectDeathReviewEntry;
  if (context.analysisMode !== "deathReview" || !radarViewport || !onSelect) {
    clearDeathReviewLayer(stage);
    return;
  }

  const renderKey = [
    context.round.roundNumber,
    context.selectedDeathReviewKey ?? "",
    radarViewport.viewportWidth,
    radarViewport.viewportHeight,
    context.deathReviewEntries.map((entry) => entry.key).join(","),
  ].join(":");
  if (stage.lastDeathReviewRenderKey === renderKey) {
    return;
  }

  clearLayer(stage.deathReviewLayer);
  renderDeathReviewMarkers(
    stage.deathReviewLayer,
    context.replay,
    context.deathReviewEntries,
    radarViewport,
    context.selectedDeathReviewKey,
    onSelect,
  );
  stage.lastDeathReviewRenderKey = renderKey;
}

function clearDeathReviewLayer(stage: StageState) {
  if (stage.deathReviewLayer.children.length > 0) {
    clearLayer(stage.deathReviewLayer);
  }
  stage.lastDeathReviewRenderKey = null;
}

function clearLiveUtilityContainers(stage: StageState) {
  for (const utilityId of [...stage.liveUtilityContainers.keys()]) {
    destroyLiveUtilityContainer(stage, utilityId);
  }
}

function destroyLiveUtilityContainer(stage: StageState, utilityId: string) {
  const containers = stage.liveUtilityContainers.get(utilityId);
  if (!containers) {
    return;
  }

  containers.trail.parent?.removeChild(containers.trail);
  containers.overlay.parent?.removeChild(containers.overlay);
  clearLayer(containers.trail);
  clearLayer(containers.overlay);
  containers.trail.destroy();
  containers.overlay.destroy();
  stage.liveUtilityContainers.delete(utilityId);
}
