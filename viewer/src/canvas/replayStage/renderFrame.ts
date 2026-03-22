import type { Replay, Round } from "../../replay/types";
import { utilityMatchesFocus, type UtilityFocus } from "../../replay/utilityFilter";
import { drawUtilityVisual } from "../utilityVisuals";
import { renderBombOverlays } from "./renderBombs";
import { renderCombatOverlays } from "./renderEvents";
import { renderPlayers } from "./renderPlayers";
import type { StageState } from "./types";

export function renderDynamicFrame(
  stage: StageState,
  replay: Replay,
  round: Round,
  currentTick: number,
  selectedPlayerId: string | null,
  utilityFocus: UtilityFocus,
  playerById: Map<string, Replay["players"][number]>,
  onSelectPlayer: (playerId: string) => void,
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
  if (needsFullRender) {
    stage.playerLayer.removeChildren().forEach((child) => child.destroy());
    stage.bombLayer.removeChildren().forEach((child) => child.destroy());
    stage.killLayer.removeChildren().forEach((child) => child.destroy());
    stage.trailLayer.removeChildren().forEach((child) => child.destroy());
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
