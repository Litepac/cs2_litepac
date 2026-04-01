import type { HeatmapBucket, HeatmapScope } from "../../replay/heatmapAnalysis";
import type { PositionPlayerSnapshot, PositionTrailEntry } from "../../replay/positionsAnalysis";
import type { ReplayAnalysisMode, UtilityAtlasEntry } from "../../replay/replayAnalysis";
import type { Replay, Round } from "../../replay/types";
import { buildHeatmapVisualCells, drawHeatmapCellVisual } from "../heatmapVisuals";
import { utilityMatchesFocus, type UtilityFocus } from "../../replay/utilityFilter";
import { drawPositionPlayerSnapshotVisual, drawPositionTrailVisual } from "../positionsVisuals";
import { drawUtilityAtlasVisual, drawUtilityVisual } from "../utilityVisuals";
import { renderBombOverlays } from "./renderBombs";
import { renderCombatOverlays } from "./renderEvents";
import { renderPlayers } from "./renderPlayers";
import type { StageState } from "./types";

export function renderDynamicFrame(
  stage: StageState,
  analysisMode: ReplayAnalysisMode,
  replay: Replay,
  round: Round,
  currentTick: number,
  selectedPlayerId: string | null,
  activeRoundIndex: number,
  heatmapCellSize: number,
  heatmapScope: HeatmapScope,
  heatmapBuckets: HeatmapBucket[],
  heatmapMaxSampleCount: number,
  positionPlayerSnapshots: PositionPlayerSnapshot[],
  positionTrailEntries: PositionTrailEntry[],
  showPositionRoundNumbers: boolean,
  positionsView: "paths" | "player",
  utilityAtlasEntries: UtilityAtlasEntry[],
  utilityFocus: UtilityFocus,
  playerById: Map<string, Replay["players"][number]>,
  onSelectPlayer: (playerId: string) => void,
  onSelectAtlasEntry?: (entry: UtilityAtlasEntry) => void,
  onSelectPositionSnapshot?: (snapshot: PositionPlayerSnapshot) => void,
) {
  const radarViewport = stage.radarViewport;
  if (!radarViewport) {
    return;
  }

  const tickRate = replay.match.tickRate || replay.sourceDemo.tickRate || 64;
  const fullRenderTick = Math.round(currentTick);
  const needsFullRender =
    stage.lastFullRenderTick !== fullRenderTick ||
    stage.lastRoundNumber !== round.roundNumber ||
    stage.lastSelectedPlayerId !== selectedPlayerId;

  stage.utilityTrailLayer.removeChildren().forEach((child) => child.destroy());
  stage.utilityTrailLayer.visible = false;
  stage.utilityOverlayLayer.removeChildren().forEach((child) => child.destroy());
  stage.trailLayer.removeChildren().forEach((child) => child.destroy());
  stage.trailLayer.visible = false;

  if (analysisMode === "utilityAtlas") {
    stage.playerLayer.removeChildren().forEach((child) => child.destroy());
    stage.bombLayer.removeChildren().forEach((child) => child.destroy());
    stage.killLayer.removeChildren().forEach((child) => child.destroy());
    stage.trailLayer.removeChildren().forEach((child) => child.destroy());
    stage.eventLayer.removeChildren().forEach((child) => child.destroy());
    stage.lastFullRenderTick = null;
    stage.lastRoundNumber = null;
    stage.lastSelectedPlayerId = null;
    stage.lastAtlasEntryKey = null;

    for (const entry of utilityAtlasEntries) {
      drawUtilityAtlasVisual(
        stage.utilityTrailLayer,
        stage.utilityOverlayLayer,
        replay,
        entry.utility,
        entry.throwerSide,
        radarViewport,
        {
          emphasize:
            selectedPlayerId != null &&
            entry.throwerPlayerId === selectedPlayerId &&
            (entry.utility.kind === "smoke" ||
              entry.utility.kind === "molotov" ||
              entry.utility.kind === "incendiary" ||
              entry.utility.kind === "decoy"),
        },
        onSelectAtlasEntry ? () => onSelectAtlasEntry(entry) : undefined,
      );
    }

    stage.utilityTrailLayer.visible = stage.utilityTrailLayer.children.length > 0;
    return;
  }

  if (analysisMode === "positions") {
    stage.playerLayer.removeChildren().forEach((child) => child.destroy());
    stage.bombLayer.removeChildren().forEach((child) => child.destroy());
    stage.killLayer.removeChildren().forEach((child) => child.destroy());
    stage.eventLayer.removeChildren().forEach((child) => child.destroy());
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
          onSelectSnapshot: onSelectPositionSnapshot,
          showRoundNumber: showPositionRoundNumbers,
        });
      }
    }

    stage.trailLayer.visible = stage.trailLayer.children.length > 0;
    return;
  }

  if (analysisMode === "heatmap") {
    stage.playerLayer.removeChildren().forEach((child) => child.destroy());
    stage.bombLayer.removeChildren().forEach((child) => child.destroy());
    stage.killLayer.removeChildren().forEach((child) => child.destroy());
    stage.eventLayer.removeChildren().forEach((child) => child.destroy());
    stage.lastFullRenderTick = null;
    stage.lastRoundNumber = null;
    stage.lastSelectedPlayerId = null;
    stage.lastAtlasEntryKey = null;

    const visualCells = buildHeatmapVisualCells(
      replay,
      {
        buckets: heatmapBuckets,
        cellSize: heatmapCellSize,
        maxSampleCount: heatmapMaxSampleCount,
        scope: heatmapScope,
      },
      selectedPlayerId != null,
    );

    for (const cell of visualCells) {
      drawHeatmapCellVisual(stage.trailLayer, replay, cell, radarViewport);
    }

    stage.trailLayer.visible = stage.trailLayer.children.length > 0;
    return;
  }

  if (needsFullRender) {
    stage.playerLayer.removeChildren().forEach((child) => child.destroy());
    stage.bombLayer.removeChildren().forEach((child) => child.destroy());
    stage.killLayer.removeChildren().forEach((child) => child.destroy());
    stage.eventLayer.removeChildren().forEach((child) => child.destroy());
  }

  for (const utility of round.utilityEntities) {
    if (!utilityMatchesFocus(utility.kind, utilityFocus)) {
      continue;
    }

    drawUtilityVisual(
      stage.utilityTrailLayer,
      stage.utilityOverlayLayer,
      replay,
      utility,
      resolveUtilityThrowerSide(round, utility.throwerPlayerId),
      playerById.get(utility.throwerPlayerId ?? "")?.displayName ?? null,
      currentTick,
      radarViewport,
      tickRate,
    );
  }
  stage.utilityTrailLayer.visible = stage.utilityTrailLayer.children.length > 0;

  if (!needsFullRender) {
    return;
  }

  stage.lastFullRenderTick = fullRenderTick;
  stage.lastRoundNumber = round.roundNumber;
  stage.lastSelectedPlayerId = selectedPlayerId;

  renderBombOverlays(stage.bombLayer, replay, round, fullRenderTick, radarViewport);
  renderCombatOverlays(stage.killLayer, replay, round, fullRenderTick, radarViewport);
  renderPlayers(
    stage.playerLayer,
    stage.eventLayer,
    replay,
    round,
    fullRenderTick,
    radarViewport,
    selectedPlayerId,
    playerById,
    onSelectPlayer,
  );
}

function resolveUtilityThrowerSide(round: Round, throwerPlayerId: string | null) {
  if (!throwerPlayerId) {
    return null;
  }

  return round.playerStreams.find((stream) => stream.playerId === throwerPlayerId)?.side ?? null;
}
