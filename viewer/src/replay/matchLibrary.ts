import { teamName } from "./derived";
import type { Replay } from "./types";

export type MatchLibrarySource = "demo" | "fixture" | "replay";

export type MatchLibraryEntry = {
  id: string;
  addedAt: string;
  replay: Replay;
  source: MatchLibrarySource;
  summary: MatchSummary;
};

export type MatchSummary = {
  mapName: string;
  mapImageUrl: string;
  teamAName: string;
  teamBName: string;
  teamAScore: number;
  teamBScore: number;
  addedLabel: string;
  sourceLabel: string;
};

export function createMatchLibraryEntry(replay: Replay, source: MatchLibrarySource, addedAt = new Date().toISOString()): MatchLibraryEntry {
  return {
    id: replay.sourceDemo.sha256,
    addedAt,
    replay,
    source,
    summary: deriveMatchSummary(replay, source, addedAt),
  };
}

export function deriveMatchSummary(replay: Replay, source: MatchLibrarySource, addedAt: string): MatchSummary {
  const orderedTeams = replay.teams.slice(0, 2);
  const [teamA, teamB] = orderedTeams;

  const wins = new Map<string, number>();
  for (const team of replay.teams) {
    wins.set(team.teamId, 0);
  }

  const playerTeam = new Map(replay.players.map((player) => [player.playerId, player.teamId]));

  for (const round of replay.rounds) {
    if (!round.winnerSide) {
      continue;
    }

    const sideTeamId = resolveTeamIdForSide(round.winnerSide, round.playerStreams, playerTeam);
    if (!sideTeamId) {
      continue;
    }

    wins.set(sideTeamId, (wins.get(sideTeamId) ?? 0) + 1);
  }

  return {
    mapName: replay.map.displayName,
    mapImageUrl: radarImageURL(replay.map.radarImageKey),
    teamAName: teamA ? teamName(replay, teamA.teamId) : "Unknown",
    teamBName: teamB ? teamName(replay, teamB.teamId) : "Unknown",
    teamAScore: teamA ? wins.get(teamA.teamId) ?? 0 : 0,
    teamBScore: teamB ? wins.get(teamB.teamId) ?? 0 : 0,
    addedLabel: formatAddedAt(addedAt),
    sourceLabel: sourceLabel(source),
  };
}

function resolveTeamIdForSide(
  side: "T" | "CT",
  streams: Replay["rounds"][number]["playerStreams"],
  playerTeam: Map<string, string>,
) {
  const counts = new Map<string, number>();
  for (const stream of streams) {
    if (stream.side !== side) {
      continue;
    }

    const teamId = playerTeam.get(stream.playerId);
    if (!teamId) {
      continue;
    }

    counts.set(teamId, (counts.get(teamId) ?? 0) + 1);
  }

  let bestTeamId: string | null = null;
  let bestCount = -1;
  for (const [teamId, count] of counts) {
    if (count > bestCount) {
      bestTeamId = teamId;
      bestCount = count;
    }
  }

  return bestTeamId;
}

function formatAddedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function sourceLabel(source: MatchLibrarySource) {
  switch (source) {
    case "demo":
      return "Uploaded Demo";
    case "fixture":
      return "Fixture";
    case "replay":
      return "Replay JSON";
  }
}

function radarImageURL(radarImageKey: string) {
  const normalizedKey = radarImageKey.replace(/^\/+/, "");
  return normalizedKey.startsWith("maps/") ? `/${normalizedKey}` : `/maps/${normalizedKey}`;
}
