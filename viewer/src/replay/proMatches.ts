import type { MatchCompetitionTier, MatchLibraryEntry } from "./matchLibrary";

export type ProMatchSort = "newest" | "oldest";

export type ProMatchFilters = {
  eventName: string;
  query: string;
  sort: ProMatchSort;
  tier: "all" | MatchCompetitionTier;
};

export function filterProMatches(matches: MatchLibraryEntry[], filters: ProMatchFilters) {
  const normalizedQuery = filters.query.trim().toLowerCase();
  const filtered = matches.filter((entry) => {
    const competition = entry.competition;
    if (!competition) {
      return false;
    }
    if (filters.eventName !== "all" && competition.eventName !== filters.eventName) {
      return false;
    }
    if (filters.tier !== "all" && competition.tier !== filters.tier) {
      return false;
    }
    if (normalizedQuery.length === 0) {
      return true;
    }

    return [
      competition.eventName,
      competition.stage ?? "",
      entry.summary.mapName,
      entry.summary.teamAName,
      entry.summary.teamBName,
      entry.summary.teamAPlayersLabel,
      entry.summary.teamBPlayersLabel,
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery);
  });

  return filtered.sort((left, right) => {
    const dateOrder = (left.competition?.playedAt ?? "").localeCompare(right.competition?.playedAt ?? "");
    if (dateOrder !== 0) {
      return filters.sort === "newest" ? -dateOrder : dateOrder;
    }
    return right.addedAt.localeCompare(left.addedAt);
  });
}

export function latestMajorEventName(matches: MatchLibraryEntry[]) {
  let latest: MatchLibraryEntry | null = null;
  for (const entry of matches) {
    if (entry.competition?.tier !== "major") {
      continue;
    }
    if (latest == null || entry.competition.playedAt > (latest.competition?.playedAt ?? "")) {
      latest = entry;
    }
  }
  return latest?.competition?.eventName ?? null;
}

export function normalizeCompetitionReferenceUrl(value: string) {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const parsed = new URL(trimmed);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Reference links must use http or https.");
  }
  return parsed.toString();
}
