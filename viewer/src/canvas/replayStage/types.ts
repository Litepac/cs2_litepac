import type { Application, Container } from "pixi.js";

import type { RadarViewport } from "../../maps/transform";
import type { UtilityFocus } from "../../replay/utilityFilter";
import type { Replay } from "../../replay/types";

export type ReplayStageProps = {
  currentTick: number;
  replay: Replay;
  round: Replay["rounds"][number];
  selectedPlayerId: string | null;
  utilityFocus: UtilityFocus;
  onSelectPlayer: (playerId: string) => void;
};

export type StageState = {
  app: Application;
  sceneRoot: Container;
  mapLayer: Container;
  utilityOverlayLayer: Container;
  utilityTrailLayer: Container;
  bombLayer: Container;
  killLayer: Container;
  trailLayer: Container;
  playerLayer: Container;
  eventLayer: Container;
  currentMapKey: string | null;
  currentViewportHeight: number | null;
  currentViewportWidth: number | null;
  lastFullRenderTick: number | null;
  lastRoundNumber: number | null;
  lastSelectedPlayerId: string | null;
  radarViewport: RadarViewport | null;
  cameraOffsetX: number;
  cameraOffsetY: number;
  cameraScale: number;
};

export type BlindEffectState = {
  progress: number;
  severity: number;
  remainingTicks: number;
};
