import assert from "node:assert/strict";
import test from "node:test";

import {
  filterProMatches,
  latestMajorEventName,
  normalizeCompetitionReferenceUrl,
} from "../src/replay/proMatches.ts";

function entry(id, eventName, playedAt, tier, mapName = "Mirage") {
  return {
    addedAt: `2026-07-0${id}T00:00:00.000Z`,
    competition: { eventName, playedAt, referenceUrl: null, stage: null, tier },
    id,
    summary: {
      mapName,
      teamAName: "Falcons",
      teamAPlayersLabel: "A / B / C / D / E",
      teamBName: "FURIA",
      teamBPlayersLabel: "F / G / H / I / J",
    },
  };
}

test("filters curated pro matches and sorts by played date", () => {
  const matches = [
    entry("1", "IEM Cologne Major 2026", "2026-06-20", "major"),
    entry("2", "IEM Cologne Major 2026", "2026-06-21", "major", "Nuke"),
    entry("3", "BLAST Bounty", "2026-07-12", "premier"),
    { ...entry("4", "Ignored", "2026-08-01", "major"), competition: null },
  ];

  assert.deepEqual(
    filterProMatches(matches, {
      eventName: "IEM Cologne Major 2026",
      query: "nuke",
      sort: "newest",
      tier: "major",
    }).map((match) => match.id),
    ["2"],
  );
  assert.deepEqual(
    filterProMatches(matches, { eventName: "all", query: "", sort: "oldest", tier: "all" }).map(
      (match) => match.id,
    ),
    ["1", "2", "3"],
  );
});

test("finds the latest locally curated major event", () => {
  const matches = [
    entry("1", "Major A", "2026-01-01", "major"),
    entry("2", "Premier B", "2026-07-01", "premier"),
    entry("3", "Major C", "2026-06-21", "major"),
  ];
  assert.equal(latestMajorEventName(matches), "Major C");
  assert.equal(latestMajorEventName(matches.map((match) => ({ ...match, competition: null }))), null);
});

test("accepts only explicit web reference links without fetching them", () => {
  assert.equal(normalizeCompetitionReferenceUrl(""), null);
  assert.equal(normalizeCompetitionReferenceUrl("https://www.hltv.org/matches/example"), "https://www.hltv.org/matches/example");
  assert.throws(() => normalizeCompetitionReferenceUrl("file:///demo.dem"), /http or https/);
});
