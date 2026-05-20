import { useEffect, useState } from "react";

import type { HeatmapScope, HeatmapSourceFilter, HeatmapTeamFilter } from "../replay/heatmapAnalysis";
import type {
  PositionPlayerSelection,
  PositionsScope,
  PositionsSourceFilter,
  PositionsTeamFilter,
  PositionsView,
} from "../replay/positionsAnalysis";
import type {
  ReplayAnalysisMode,
  UtilityAtlasScope,
  UtilityAtlasSourceFilter,
  UtilityAtlasTeamFilter,
} from "../replay/replayAnalysis";
import type { UtilityFocus } from "../replay/utilityFilter";

export type ReplayTickJump = {
  roundIndex: number;
  tick: number;
};

type UseReplayWorkspaceStateInput = {
  replayId: string | null;
  selectedPlayerId: string | null;
};

export function useReplayWorkspaceState({ replayId, selectedPlayerId }: UseReplayWorkspaceStateInput) {
  const [utilityFocus, setUtilityFocus] = useState<UtilityFocus>("all");
  const [showFreezeTime, setShowFreezeTime] = useState(false);
  const [analysisMode, setAnalysisMode] = useState<ReplayAnalysisMode>("live");
  const [utilityAtlasScope, setUtilityAtlasScope] = useState<UtilityAtlasScope>("round");
  const [utilityAtlasTeamFilter, setUtilityAtlasTeamFilter] = useState<UtilityAtlasTeamFilter>("all");
  const [utilityAtlasSourceFilter, setUtilityAtlasSourceFilter] = useState<UtilityAtlasSourceFilter>("all");
  const [selectedUtilityAtlasKey, setSelectedUtilityAtlasKey] = useState<string | null>(null);
  const [positionsScope, setPositionsScope] = useState<PositionsScope>("round");
  const [positionsTeamFilter, setPositionsTeamFilter] = useState<PositionsTeamFilter>("all");
  const [positionsSourceFilter, setPositionsSourceFilter] = useState<PositionsSourceFilter>("all");
  const [positionsView, setPositionsView] = useState<PositionsView>("paths");
  const [positionPlayerSelections, setPositionPlayerSelections] = useState<PositionPlayerSelection[]>([]);
  const [positionPlayerBroadCompareEnabled, setPositionPlayerBroadCompareEnabled] = useState(false);
  const [positionPlayerCompareEnabled, setPositionPlayerCompareEnabled] = useState(false);
  const [showPositionRoundNumbers, setShowPositionRoundNumbers] = useState(false);
  const [heatmapScope, setHeatmapScope] = useState<HeatmapScope>("round");
  const [heatmapTeamFilter, setHeatmapTeamFilter] = useState<HeatmapTeamFilter>("all");
  const [heatmapSourceFilter, setHeatmapSourceFilter] = useState<HeatmapSourceFilter>("all");
  const [livePlayerContextMode, setLivePlayerContextMode] = useState(false);
  const [pendingUtilityJump, setPendingUtilityJump] = useState<ReplayTickJump | null>(null);
  const [pendingPositionJump, setPendingPositionJump] = useState<ReplayTickJump | null>(null);
  const [pendingDeathJump, setPendingDeathJump] = useState<ReplayTickJump | null>(null);
  const [selectedDeathReviewKey, setSelectedDeathReviewKey] = useState<string | null>(null);

  useEffect(() => {
    if (selectedPlayerId == null && utilityAtlasSourceFilter === "selected") {
      setUtilityAtlasSourceFilter("all");
    }
    if (selectedPlayerId == null && positionsSourceFilter === "selected") {
      setPositionsSourceFilter("all");
      setPositionPlayerSelections([]);
      setPositionPlayerBroadCompareEnabled(false);
      setPositionPlayerCompareEnabled(false);
    }
    if (selectedPlayerId == null && heatmapSourceFilter === "selected") {
      setHeatmapSourceFilter("all");
    }
  }, [heatmapSourceFilter, positionsSourceFilter, selectedPlayerId, utilityAtlasSourceFilter]);

  useEffect(() => {
    if (!replayId) {
      return;
    }

    setAnalysisMode("live");
    setUtilityFocus("all");
    setShowFreezeTime(false);
    setUtilityAtlasScope("round");
    setUtilityAtlasTeamFilter("all");
    setUtilityAtlasSourceFilter("all");
    setSelectedUtilityAtlasKey(null);
    setPositionsScope("round");
    setPositionsTeamFilter("all");
    setPositionsSourceFilter("all");
    setPositionsView("paths");
    setPositionPlayerSelections([]);
    setPositionPlayerBroadCompareEnabled(false);
    setPositionPlayerCompareEnabled(false);
    setShowPositionRoundNumbers(false);
    setHeatmapScope("round");
    setHeatmapTeamFilter("all");
    setHeatmapSourceFilter("all");
    setLivePlayerContextMode(false);
    setPendingUtilityJump(null);
    setPendingPositionJump(null);
    setPendingDeathJump(null);
    setSelectedDeathReviewKey(null);
  }, [replayId]);

  return {
    analysisMode,
    heatmapScope,
    heatmapSourceFilter,
    heatmapTeamFilter,
    livePlayerContextMode,
    pendingDeathJump,
    pendingPositionJump,
    pendingUtilityJump,
    positionPlayerBroadCompareEnabled,
    positionPlayerCompareEnabled,
    positionPlayerSelections,
    positionsScope,
    positionsSourceFilter,
    positionsTeamFilter,
    positionsView,
    selectedDeathReviewKey,
    selectedUtilityAtlasKey,
    setAnalysisMode,
    setHeatmapScope,
    setHeatmapSourceFilter,
    setHeatmapTeamFilter,
    setLivePlayerContextMode,
    setPendingDeathJump,
    setPendingPositionJump,
    setPendingUtilityJump,
    setPositionPlayerBroadCompareEnabled,
    setPositionPlayerCompareEnabled,
    setPositionPlayerSelections,
    setPositionsScope,
    setPositionsSourceFilter,
    setPositionsTeamFilter,
    setPositionsView,
    setSelectedDeathReviewKey,
    setSelectedUtilityAtlasKey,
    setShowFreezeTime,
    setShowPositionRoundNumbers,
    setUtilityAtlasScope,
    setUtilityAtlasSourceFilter,
    setUtilityAtlasTeamFilter,
    setUtilityFocus,
    showFreezeTime,
    showPositionRoundNumbers,
    utilityAtlasScope,
    utilityAtlasSourceFilter,
    utilityAtlasTeamFilter,
    utilityFocus,
  };
}
