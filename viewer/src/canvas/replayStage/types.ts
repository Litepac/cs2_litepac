import type { Application, Container } from "pixi.js";

import type { HeatmapBucket } from "../../replay/heatmapAnalysis";
import type { PositionPlayerSnapshot, PositionTrailEntry, PositionsView } from "../../replay/positionsAnalysis";
import type { ReplayAnalysisMode, UtilityAtlasEntry } from "../../replay/replayAnalysis";
import type { DeathReviewEntry } from "../../replay/deathReview";
import type { HeatmapScope } from "../../replay/heatmapAnalysis";
import type { RadarViewport } from "../../maps/transform";
import type { UtilityFocus } from "../../replay/utilityFilter";
import type { Replay } from "../../replay/types";

export type ReplayStageProps = {
  activeRoundIndex: number;
  analysisMode: ReplayAnalysisMode;
  heatmapCellSize: number;
  heatmapScope: HeatmapScope;
  currentTick: number;
  heatmapBuckets: HeatmapBucket[];
  heatmapMaxSampleCount: number;
  livePlayerContextMode: boolean;
  deathReviewEntries: DeathReviewEntry[];
  onSelectAtlasEntry?: (entry: UtilityAtlasEntry) => void;
  onSelectDeathReviewEntry?: (entry: DeathReviewEntry) => void;
  positionPlayerSnapshots: PositionPlayerSnapshot[];
  positionTrailEntries: PositionTrailEntry[];
  showPositionRoundNumbers: boolean;
  positionsView: PositionsView;
  replay: Replay;
  round: Replay["rounds"][number];
  selectedUtilityAtlasKey: string | null;
  selectedDeathReviewKey: string | null;
  selectedPlayerId: string | null;
  utilityAtlasEntries: UtilityAtlasEntry[];
  utilityFocus: UtilityFocus;
  onSelectPositionSnapshot?: (snapshot: PositionPlayerSnapshot) => void;
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
  mapClipMask: Container | null;
  trailLayer: Container;
  playerLayer: Container;
  eventLayer: Container;
  lastAtlasEntryKey: string | null;
  currentMapKey: string | null;
  currentRenderResolution: number;
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
