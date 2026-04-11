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
  teamAPlayersLabel: string;
  teamBPlayersLabel: string;
  teamAScore: number;
  teamBScore: number;
  winnerTeamId: string | null;
  winnerTeamName: string | null;
  teamAResult: "win" | "loss" | "draw";
  teamBResult: "win" | "loss" | "draw";
  playedLabel: string | null;
  playedStatusLabel: string;
  addedLabel: string;
  addedStatusLabel: string;
  sourceLabel: string;
};

export function createMatchLibraryEntry(replay: Replay, source: MatchLibrarySource, addedAt = new Date().toISOString()): MatchLibraryEntry {
  const entryId = createMatchLibraryEntryId(replay, source, addedAt);

  return {
    id: entryId,
    addedAt,
    replay,
    source,
    summary: deriveMatchSummary(replay, source, addedAt),
  };
}

export function createMatchLibraryFingerprint(replay: Replay, source: MatchLibrarySource) {
  return `${source}:${replay.sourceDemo.sha256}`;
}

function createMatchLibraryEntryId(replay: Replay, source: MatchLibrarySource, addedAt: string) {
  return `${createMatchLibraryFingerprint(replay, source)}:${addedAt}`;
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

  const teamAScore = teamA ? wins.get(teamA.teamId) ?? 0 : 0;
  const teamBScore = teamB ? wins.get(teamB.teamId) ?? 0 : 0;
  const winnerTeamId =
    !teamA || !teamB ? null : teamAScore === teamBScore ? null : teamAScore > teamBScore ? teamA.teamId : teamB.teamId;

  return {
    mapName: replay.map.displayName,
    mapImageUrl: mapBannerURL(replay.map.mapId),
    teamAName: teamA ? teamName(replay, teamA.teamId) : "Unknown",
    teamBName: teamB ? teamName(replay, teamB.teamId) : "Unknown",
    teamAPlayersLabel: teamRosterLabel(replay, teamA?.teamId ?? null),
    teamBPlayersLabel: teamRosterLabel(replay, teamB?.teamId ?? null),
    teamAScore,
    teamBScore,
    winnerTeamId,
    winnerTeamName: winnerTeamId ? teamName(replay, winnerTeamId) : null,
    teamAResult: teamResult(teamA?.teamId ?? null, winnerTeamId),
    teamBResult: teamResult(teamB?.teamId ?? null, winnerTeamId),
    playedLabel: null,
    playedStatusLabel: "Played",
    addedLabel: formatAddedAt(addedAt),
    addedStatusLabel: sourceTimeLabel(source),
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

function teamRosterLabel(replay: Replay, teamId: string | null) {
  const names = teamRosterNames(replay, teamId);
  if (names.length === 0) {
    return "Players unavailable";
  }

  return names.join(" / ");
}

function teamRosterNames(replay: Replay, teamId: string | null) {
  if (!teamId) {
    return [];
  }

  const names = Array.from(
    new Set(
      replay.players
        .filter((player) => player.teamId === teamId)
        .map((player) => player.displayName.trim())
        .filter((name) => name.length > 0),
    ),
  );

  return names;
}

function teamResult(teamId: string | null, winnerTeamId: string | null): "win" | "loss" | "draw" {
  if (!teamId || !winnerTeamId) {
    return "draw";
  }

  return teamId === winnerTeamId ? "win" : "loss";
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

function sourceTimeLabel(source: MatchLibrarySource) {
  switch (source) {
    case "demo":
      return "Uploaded";
    case "fixture":
      return "Added";
    case "replay":
      return "Added";
  }
}

function mapBannerURL(mapId: string) {
  const bannerId = MAP_BANNER_IDS.has(mapId) ? mapId : "default-banner";
  return bannerId === "default-banner" ? "/maps/default-banner.svg" : `/maps/${bannerId}/banner.svg`;
}

const MAP_BANNER_IDS = new Set([
  "de_ancient",
  "de_anubis",
  "de_dust2",
  "de_inferno",
  "de_mirage",
  "de_nuke",
  "de_overpass",
  "de_train",
  "de_vertigo",
]);
