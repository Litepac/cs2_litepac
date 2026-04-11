import type { Replay, Round } from "./types";

export type Side = "T" | "CT";

export function teamName(replay: Replay, teamId: string | null) {
  if (!teamId) {
    return "Unknown";
  }

  const displayName = replay.teams.find((team) => team.teamId === teamId)?.displayName ?? teamId;
  return normalizeTeamName(displayName);
}

export function scoreForSide(round: Round, side: Side, phase: "before" | "after") {
  const score = phase === "before" ? round.scoreBefore : round.scoreAfter;
  return side === "T" ? score.t : score.ct;
}

export function sideTeam(replay: Replay, round: Round, side: Side) {
  const stream = round.playerStreams.find((entry) => entry.side === side);
  if (!stream) {
    return null;
  }

  const player = replay.players.find((entry) => entry.playerId === stream.playerId);
  if (!player) {
    return null;
  }

  return {
    teamId: player.teamId,
    displayName: teamName(replay, player.teamId),
  };
}

function normalizeTeamName(displayName: string) {
  const trimmed = displayName.trim();
  if (!trimmed) {
    return displayName;
  }

  if (trimmed.toLowerCase().startsWith("team_")) {
    const normalized = trimmed.slice(5).replaceAll("_", " ").trim();
    return normalized || displayName;
  }

  return trimmed;
}
