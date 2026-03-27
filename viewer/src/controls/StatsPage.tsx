import { useMemo, useState } from "react";

import { deriveMatchStats, type MatchRoundBreakdown, type MatchStatsPlayerRow, type MatchStatsSideFilter, type MatchStatsTeamTable } from "../replay/matchStats";
import type { MatchLibraryEntry } from "../replay/matchLibrary";

type Props = {
  entry: MatchLibraryEntry;
  onBackToMatches: () => void;
  onOpenReplay: (id: string) => void;
};

type SortKey = "adr" | "assists" | "deaths" | "kast" | "kdDiff" | "kdRatio" | "kills" | "name" | "openingDuels" | "roundsPlayed" | "utilityDamage";
type SortDirection = "asc" | "desc";

const SIDE_FILTERS: Array<{ label: string; value: MatchStatsSideFilter }> = [
  { label: "Both Sides", value: "all" },
  { label: "T Side", value: "T" },
  { label: "CT Side", value: "CT" },
];

const TABLE_COLUMNS: Array<{ key: SortKey; label: string }> = [
  { key: "name", label: "Player" },
  { key: "kills", label: "K / A / D" },
  { key: "kdDiff", label: "KD Diff" },
  { key: "kdRatio", label: "K/D" },
  { key: "adr", label: "ADR" },
  { key: "kast", label: "KAST" },
  { key: "utilityDamage", label: "UDR" },
  { key: "openingDuels", label: "Op. Duels" },
  { key: "roundsPlayed", label: "Rounds" },
];

export function StatsPage({ entry, onBackToMatches, onOpenReplay }: Props) {
  const [sideFilter, setSideFilter] = useState<MatchStatsSideFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("adr");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const stats = useMemo(() => deriveMatchStats(entry.replay, sideFilter), [entry.replay, sideFilter]);

  const sortedTeams = useMemo(
    () =>
      stats.teams.map((team) => ({
        ...team,
        players: [...team.players].sort((left, right) => compareRows(left, right, sortKey, sortDirection)),
      })),
    [sortDirection, sortKey, stats.teams],
  );

  return (
    <section className="stats-page">
      <header className="stats-header">
        <div className="stats-heading">
          <div className="eyebrow">Match Stats</div>
          <h1>{entry.summary.mapName}</h1>
          <div className="stats-matchline">
            <strong>{entry.summary.teamAName}</strong>
            <span>{entry.summary.teamAScore}</span>
            <small>-</small>
            <span>{entry.summary.teamBScore}</span>
            <strong>{entry.summary.teamBName}</strong>
          </div>
          <div className="stats-context-line">
            <span>{entry.summary.addedLabel}</span>
            <span>{entry.summary.sourceLabel}</span>
            <span>{entry.replay.map.mapId}</span>
          </div>
        </div>

        <div className="stats-header-actions">
          <button type="button" className="stats-header-button stats-header-button-secondary" onClick={onBackToMatches}>
            Back to Matches
          </button>
          <button type="button" className="stats-header-button stats-header-button-primary" onClick={() => onOpenReplay(entry.id)}>
            Open 2D Replay
          </button>
        </div>
      </header>

      <div className="stats-toolbar">
        <div className="stats-side-filter" role="tablist" aria-label="Side filter">
          {SIDE_FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={option.value === sideFilter ? "stats-side-filter-button stats-side-filter-button-active" : "stats-side-filter-button"}
              onClick={() => setSideFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="stats-team-grid">
        {sortedTeams.map((team, index) => (
          <section
            key={team.teamId}
            className={`stats-team-card ${index === 0 ? "stats-team-card-ct" : "stats-team-card-t"}`}
          >
            <div className="stats-team-card-header">
              <div>
                <div className="card-title">{index === 0 ? "CT Focus" : "T Focus"}</div>
                <strong>{team.teamName}</strong>
              </div>
              <span>{sideFilter === "all" ? "Full match" : `${sideFilter} rounds only`}</span>
            </div>

            <div className="stats-table">
              <div className="stats-table-head">
                {TABLE_COLUMNS.map((column) => (
                  <button
                    key={column.key}
                    type="button"
                    className={column.key === sortKey ? "stats-sort-head stats-sort-head-active" : "stats-sort-head"}
                    onClick={() => {
                      if (sortKey === column.key) {
                        setSortDirection((current) => (current === "desc" ? "asc" : "desc"));
                        return;
                      }

                      setSortKey(column.key);
                      setSortDirection(column.key === "name" ? "asc" : "desc");
                    }}
                  >
                    {column.label}
                  </button>
                ))}
              </div>

              <div className="stats-table-body">
                {team.players.map((player) => (
                  <StatsRow key={player.playerId} player={player} />
                ))}
              </div>
            </div>
          </section>
        ))}
      </div>

      <section className="stats-rounds-card">
        <div className="stats-rounds-header">
          <div>
            <div className="card-title">Rounds</div>
            <strong>Compact breakdown</strong>
          </div>
          <span>Winner, score, and bomb resolution per round</span>
        </div>

        <div className="stats-round-grid">
          {stats.rounds.map((round) => (
            <RoundChip key={round.roundNumber} round={round} />
          ))}
        </div>
      </section>
    </section>
  );
}

function StatsRow({ player }: { player: MatchStatsPlayerRow }) {
  return (
    <div className="stats-table-row">
      <div className="stats-player-cell">
        <strong>{player.displayName}</strong>
        <small>{player.roundsPlayed} rounds</small>
      </div>
      <div className="stats-stat-cell stats-stat-cell-kad">
        <strong>{player.kills}</strong>
        <small>{player.assists}</small>
        <small>{player.deaths}</small>
      </div>
      <div className={`stats-stat-cell ${player.kdDiff >= 0 ? "stats-stat-positive" : "stats-stat-negative"}`}>
        {formatSigned(player.kdDiff)}
      </div>
      <div className="stats-stat-cell">{player.kdRatio.toFixed(2)}</div>
      <div className="stats-stat-cell stats-stat-cell-highlight">{player.adr.toFixed(1)}</div>
      <div className="stats-stat-cell">{player.kast.toFixed(0)}%</div>
      <div className="stats-stat-cell">{player.utilityDamage.toFixed(1)}</div>
      <div className="stats-stat-cell">
        {player.openingDuelsWins}-{player.openingDuelsLosses}
      </div>
      <div className="stats-stat-cell">{player.roundsPlayed}</div>
    </div>
  );
}

function RoundChip({ round }: { round: MatchRoundBreakdown }) {
  return (
    <div
      className={[
        "stats-round-chip",
        round.winnerSide === "CT" ? "stats-round-chip-ct" : "",
        round.winnerSide === "T" ? "stats-round-chip-t" : "",
      ].filter(Boolean).join(" ")}
    >
      <span className="stats-round-number">{round.roundNumber}</span>
      <strong>
        {round.scoreAfter.ct}-{round.scoreAfter.t}
      </strong>
      <small>{round.defused ? "Defuse" : round.exploded ? "Explode" : round.planted ? "Plant" : round.endReason ?? "Win"}</small>
    </div>
  );
}

function compareRows(left: MatchStatsPlayerRow, right: MatchStatsPlayerRow, sortKey: SortKey, sortDirection: SortDirection) {
  const factor = sortDirection === "desc" ? -1 : 1;

  if (sortKey === "name") {
    return factor * left.displayName.localeCompare(right.displayName);
  }

  if (sortKey === "openingDuels") {
    const leftValue = left.openingDuelsWins - left.openingDuelsLosses;
    const rightValue = right.openingDuelsWins - right.openingDuelsLosses;
    return factor * compareNumber(leftValue, rightValue, left.displayName, right.displayName);
  }

  return factor * compareNumber(left[sortKey], right[sortKey], left.displayName, right.displayName);
}

function compareNumber(left: number, right: number, leftName: string, rightName: string) {
  if (left === right) {
    return leftName.localeCompare(rightName);
  }

  return left < right ? -1 : 1;
}

function formatSigned(value: number) {
  return value > 0 ? `+${value}` : `${value}`;
}
