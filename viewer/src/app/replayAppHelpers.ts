import type { Side } from "../replay/derived";
import type { PositionPlayerSelection, PositionsTeamFilter } from "../replay/positionsAnalysis";
import type { UtilityAtlasEntry } from "../replay/replayAnalysis";
import type { Replay } from "../replay/types";
import type { UtilityFocus } from "../replay/utilityFilter";

export function resolvePositionPlayerTeamFilter(
  selections: PositionPlayerSelection[],
  currentTeamFilter: PositionsTeamFilter,
): PositionsTeamFilter {
  if (selections.length === 0) {
    return "all";
  }

  if (currentTeamFilter === "all") {
    return "all";
  }

  return selections.every((player) => player.side === currentTeamFilter) ? currentTeamFilter : "all";
}

export function resolvePositionPlayerSelection(
  replay: Replay,
  roundIndex: number,
  playerId: string,
): PositionPlayerSelection | null {
  const activeRoundSide = replay.rounds[roundIndex]?.playerStreams.find((stream) => stream.playerId === playerId)?.side ?? null;
  const displayName = replay.players.find((player) => player.playerId === playerId)?.displayName ?? null;

  if (activeRoundSide) {
    return {
      playerIds: collectPositionPlayerIdsByNameAndSide(replay, playerId, displayName, activeRoundSide),
      side: activeRoundSide,
    };
  }

  for (const round of replay.rounds) {
    const playerSide = round.playerStreams.find((stream) => stream.playerId === playerId)?.side ?? null;
    if (playerSide) {
      return {
        playerIds: collectPositionPlayerIdsByNameAndSide(replay, playerId, displayName, playerSide),
        side: playerSide,
      };
    }
  }

  return null;
}

export function toPositionPlayerRosterSelectionKey(playerIds: string[], side: Side) {
  const normalizedPlayerIds = [...new Set(playerIds)].sort();
  return `${side}:${normalizedPlayerIds.join("|")}`;
}

export function resolveUtilityAtlasLiveFocus(kind: UtilityAtlasEntry["utility"]["kind"]): UtilityFocus {
  if (kind === "molotov" || kind === "incendiary") {
    return "fire";
  }

  return kind;
}

function collectPositionPlayerIdsByNameAndSide(
  replay: Replay,
  playerId: string,
  displayName: string | null,
  side: Side,
) {
  if (!displayName) {
    return [playerId];
  }

  const groupedPlayerIds = replay.players
    .filter((player) => player.displayName === displayName)
    .map((player) => player.playerId)
    .filter((candidatePlayerId) =>
      replay.rounds.some((round) =>
        round.playerStreams.some((stream) => stream.playerId === candidatePlayerId && stream.side === side),
      ),
    );

  return groupedPlayerIds.length > 0 ? groupedPlayerIds : [playerId];
}
