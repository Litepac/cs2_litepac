import { useMemo } from "react";

import {
  collectHeatmapSnapshot,
  type HeatmapSnapshot,
  type HeatmapScope,
  type HeatmapSourceFilter,
  type HeatmapTeamFilter,
} from "../replay/heatmapAnalysis";
import {
  collectPositionPlayerSnapshots,
  collectPositionTrailEntries,
  type PositionPlayerSelection,
  type PositionsScope,
  type PositionsSourceFilter,
  type PositionsTeamFilter,
  type PositionsView,
} from "../replay/positionsAnalysis";
import {
  buildReplaySideBlocks,
  collectUtilityAtlasEntries,
  type UtilityAtlasScope,
  type UtilityAtlasSourceFilter,
  type UtilityAtlasTeamFilter,
} from "../replay/replayAnalysis";
import type { Replay, Round } from "../replay/types";
import type { UtilityFocus } from "../replay/utilityFilter";

type Args = {
  heatmapScope: HeatmapScope;
  heatmapSourceFilter: HeatmapSourceFilter;
  heatmapTeamFilter: HeatmapTeamFilter;
  playbackInitialRoundTick: number;
  playbackRenderTick: number;
  positionPlayerBroadCompareEnabled: boolean;
  positionPlayerSelections: PositionPlayerSelection[];
  positionsScope: PositionsScope;
  positionsSourceFilter: PositionsSourceFilter;
  positionsTeamFilter: PositionsTeamFilter;
  positionsView: PositionsView;
  replay: Replay | null;
  round: Round | null;
  roundIndex: number;
  selectedPlayerId: string | null;
  showFreezeTime: boolean;
  utilityAtlasScope: UtilityAtlasScope;
  utilityAtlasSourceFilter: UtilityAtlasSourceFilter;
  utilityAtlasTeamFilter: UtilityAtlasTeamFilter;
  utilityFocus: UtilityFocus;
};

const EMPTY_HEATMAP_SNAPSHOT: HeatmapSnapshot = {
  buckets: [],
  cellSize: 0,
  maxSampleCount: 0,
  playerCount: 0,
  roundCount: 0,
  sampleCount: 0,
};

export function useReplayAnalysisState({
  heatmapScope,
  heatmapSourceFilter,
  heatmapTeamFilter,
  playbackInitialRoundTick,
  playbackRenderTick,
  positionPlayerBroadCompareEnabled,
  positionPlayerSelections,
  positionsScope,
  positionsSourceFilter,
  positionsTeamFilter,
  positionsView,
  replay,
  round,
  roundIndex,
  selectedPlayerId,
  showFreezeTime,
  utilityAtlasScope,
  utilityAtlasSourceFilter,
  utilityAtlasTeamFilter,
  utilityFocus,
}: Args) {
  const replaySideBlocks = useMemo(() => (replay ? buildReplaySideBlocks(replay) : []), [replay]);

  const utilityAtlasEntries = useMemo(
    () =>
      replay
        ? collectUtilityAtlasEntries(replay, roundIndex, replaySideBlocks, selectedPlayerId, {
            scope: utilityAtlasScope,
            sourceFilter: utilityAtlasSourceFilter,
            teamFilter: utilityAtlasTeamFilter,
            utilityFocus,
          })
        : [],
    [replay, replaySideBlocks, roundIndex, selectedPlayerId, utilityAtlasScope, utilityAtlasSourceFilter, utilityAtlasTeamFilter, utilityFocus],
  );

  const effectivePositionsScope: PositionsScope = positionsView === "player" ? "match" : positionsScope;

  const positionTrailEntries = useMemo(
    () =>
      replay
        ? collectPositionTrailEntries(replay, roundIndex, replaySideBlocks, selectedPlayerId, {
            scope: effectivePositionsScope,
            sourceFilter: positionsSourceFilter,
            teamFilter: positionsTeamFilter,
          })
        : [],
    [effectivePositionsScope, positionsSourceFilter, positionsTeamFilter, replay, replaySideBlocks, roundIndex, selectedPlayerId],
  );

  const positionsComparisonOffsetTicks = useMemo(() => {
    if (!round) {
      return 0;
    }

    const comparisonStartTick = showFreezeTime ? round.startTick : playbackInitialRoundTick;
    const visibleComparisonTick = Math.max(playbackRenderTick, comparisonStartTick);
    return Math.round(visibleComparisonTick - comparisonStartTick);
  }, [playbackInitialRoundTick, playbackRenderTick, round, showFreezeTime]);

  const displayedPositionTrailEntries = useMemo(() => {
    if (positionsView === "player") {
      return [];
    }

    if (selectedPlayerId != null) {
      return positionTrailEntries.filter((entry) => entry.playerId === selectedPlayerId);
    }

    return positionTrailEntries;
  }, [positionTrailEntries, positionsView, selectedPlayerId]);

  const positionPlayerSnapshots = useMemo(() => {
    if (!replay || positionsView !== "player") {
      return [];
    }

    if (positionsSourceFilter === "selected") {
      return collectPositionPlayerSnapshots(
        replay,
        positionPlayerSelections,
        positionsTeamFilter,
        positionsComparisonOffsetTicks,
        showFreezeTime,
      );
    }

    if (!positionPlayerBroadCompareEnabled) {
      return [];
    }

    return collectPositionPlayerSnapshots(
      replay,
      [],
      positionsTeamFilter,
      positionsComparisonOffsetTicks,
      showFreezeTime,
    );
  }, [
    positionPlayerBroadCompareEnabled,
    positionPlayerSelections,
    positionsComparisonOffsetTicks,
    positionsSourceFilter,
    positionsTeamFilter,
    positionsView,
    replay,
    showFreezeTime,
  ]);

  const heatmapSnapshot = useMemo(
    () =>
      replay
        ? collectHeatmapSnapshot(replay, roundIndex, replaySideBlocks, selectedPlayerId, {
            scope: heatmapScope,
            sourceFilter: heatmapSourceFilter,
            teamFilter: heatmapTeamFilter,
          })
        : EMPTY_HEATMAP_SNAPSHOT,
    [heatmapScope, heatmapSourceFilter, heatmapTeamFilter, replay, replaySideBlocks, roundIndex, selectedPlayerId],
  );

  return {
    displayedPositionTrailEntries,
    heatmapSnapshot,
    positionPlayerSnapshots,
    utilityAtlasEntries,
  };
}
