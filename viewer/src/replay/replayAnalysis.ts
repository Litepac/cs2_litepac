import { sideTeam, type Side } from "./derived";
import type { UtilityFocus } from "./utilityFilter";
import { utilityMatchesFocus } from "./utilityFilter";
import type { Replay, UtilityEntity } from "./types";

export type ReplayAnalysisMode = "live" | "utilityAtlas" | "positions" | "heatmap";
export type ReplayAnalysisScope = "round" | "sideBlock" | "match";
export type ReplayAnalysisTeamFilter = "all" | Side;
export type ReplayAnalysisSourceFilter = "all" | "selected";
export type UtilityAtlasScope = ReplayAnalysisScope;
export type UtilityAtlasTeamFilter = ReplayAnalysisTeamFilter;
export type UtilityAtlasSourceFilter = ReplayAnalysisSourceFilter;

export type ReplaySideBlock = {
  endRoundIndex: number;
  key: string;
  label: string;
  startRoundIndex: number;
};

export type UtilityAtlasConfig = {
  scope: UtilityAtlasScope;
  sourceFilter: UtilityAtlasSourceFilter;
  teamFilter: UtilityAtlasTeamFilter;
  utilityFocus: UtilityFocus;
};

export type UtilityAtlasEntry = {
  key: string;
  jumpTick: number;
  roundIndex: number;
  roundNumber: number;
  throwerPlayerId: string | null;
  throwerSide: Side | null;
  utility: UtilityEntity;
};

export function analysisScopeLabel(
  replay: Replay,
  activeRoundIndex: number,
  sideBlocks: ReplaySideBlock[],
  scope: ReplayAnalysisScope,
) {
  switch (scope) {
    case "round":
      return `Round ${activeRoundIndex + 1}`;
    case "match":
      return "Full Match";
    case "sideBlock": {
      const block = findReplaySideBlock(sideBlocks, activeRoundIndex);
      if (!block) {
        return "Current Half";
      }

      const startLabel = replay.rounds[block.startRoundIndex]?.roundNumber ?? block.startRoundIndex + 1;
      const endLabel = replay.rounds[block.endRoundIndex]?.roundNumber ?? block.endRoundIndex + 1;
      return `${block.label} - R${startLabel}-${endLabel}`;
    }
    default:
      return scope;
  }
}

export function buildReplaySideBlocks(replay: Replay): ReplaySideBlock[] {
  if (replay.rounds.length === 0) {
    return [];
  }

  const blocks: ReplaySideBlock[] = [];
  let blockStart = 0;
  let previousSignature = sideAssignmentSignature(replay, replay.rounds[0]);

  for (let roundIndex = 1; roundIndex < replay.rounds.length; roundIndex += 1) {
    const round = replay.rounds[roundIndex];
    const signature = sideAssignmentSignature(replay, round);
    if (signature === previousSignature) {
      continue;
    }

    blocks.push(createSideBlock(blocks.length, blockStart, roundIndex - 1));
    blockStart = roundIndex;
    previousSignature = signature;
  }

  blocks.push(createSideBlock(blocks.length, blockStart, replay.rounds.length - 1));
  return blocks;
}

export function findReplaySideBlock(
  sideBlocks: ReplaySideBlock[],
  roundIndex: number,
) {
  return sideBlocks.find((block) => roundIndex >= block.startRoundIndex && roundIndex <= block.endRoundIndex) ?? sideBlocks[0] ?? null;
}

export function collectUtilityAtlasEntries(
  replay: Replay,
  activeRoundIndex: number,
  sideBlocks: ReplaySideBlock[],
  selectedPlayerId: string | null,
  config: UtilityAtlasConfig,
): UtilityAtlasEntry[] {
  const rounds = collectAnalysisRounds(replay, activeRoundIndex, sideBlocks, config.scope);

  return rounds.flatMap(({ round, roundIndex }) =>
    round.utilityEntities.flatMap((utility) => {
      if (!utilityMatchesFocus(utility.kind, config.utilityFocus)) {
        return [];
      }

      const throwerSide = resolveUtilityThrowerSide(round, utility.throwerPlayerId);
      if (config.teamFilter !== "all" && throwerSide !== config.teamFilter) {
        return [];
      }

      if (config.sourceFilter === "selected" && utility.throwerPlayerId !== selectedPlayerId) {
        return [];
      }

      return [
        {
          jumpTick: resolveUtilityAtlasJumpTick(utility),
          key: `${round.roundNumber}:${utility.utilityId}`,
          roundIndex,
          roundNumber: round.roundNumber,
          throwerPlayerId: utility.throwerPlayerId,
          throwerSide,
          utility,
        } satisfies UtilityAtlasEntry,
      ];
    }),
  );
}

function resolveUtilityAtlasJumpTick(utility: UtilityEntity) {
  const detonateTick =
    utility.detonateTick ??
    utility.phaseEvents.find((event) => event.type === "detonate")?.tick ??
    null;
  if (detonateTick != null) {
    return detonateTick;
  }

  return utility.startTick;
}

export function utilityAtlasScopeLabel(
  replay: Replay,
  activeRoundIndex: number,
  sideBlocks: ReplaySideBlock[],
  scope: UtilityAtlasScope,
) {
  return analysisScopeLabel(replay, activeRoundIndex, sideBlocks, scope);
}

export function collectAnalysisRounds(
  replay: Replay,
  activeRoundIndex: number,
  sideBlocks: ReplaySideBlock[],
  scope: ReplayAnalysisScope,
) {
  switch (scope) {
    case "round":
      return replay.rounds[activeRoundIndex] ? [{ round: replay.rounds[activeRoundIndex], roundIndex: activeRoundIndex }] : [];
    case "match":
      return replay.rounds.map((round, roundIndex) => ({ round, roundIndex }));
    case "sideBlock": {
      const block = findReplaySideBlock(sideBlocks, activeRoundIndex);
      if (!block) {
        return replay.rounds[activeRoundIndex] ? [{ round: replay.rounds[activeRoundIndex], roundIndex: activeRoundIndex }] : [];
      }

      return replay.rounds
        .slice(block.startRoundIndex, block.endRoundIndex + 1)
        .map((round, index) => ({ round, roundIndex: block.startRoundIndex + index }));
    }
    default:
      return [];
  }
}

function resolveUtilityThrowerSide(
  round: Replay["rounds"][number],
  throwerPlayerId: string | null,
): Side | null {
  if (!throwerPlayerId) {
    return null;
  }

  return round.playerStreams.find((stream) => stream.playerId === throwerPlayerId)?.side ?? null;
}

function sideAssignmentSignature(replay: Replay, round: Replay["rounds"][number]) {
  const ctTeam = sideTeam(replay, round, "CT")?.teamId ?? "unknown-ct";
  const tTeam = sideTeam(replay, round, "T")?.teamId ?? "unknown-t";
  return `${ctTeam}|${tTeam}`;
}

function createSideBlock(index: number, startRoundIndex: number, endRoundIndex: number): ReplaySideBlock {
  const regulationLabel = index < 2 ? `Half ${index + 1}` : `OT Block ${index - 1}`;
  return {
    endRoundIndex,
    key: `side-block-${index}-${startRoundIndex}-${endRoundIndex}`,
    label: regulationLabel,
    startRoundIndex,
  };
}
