import { useMemo, useState } from "react";

import { deriveMatchStats } from "../replay/matchStats";
import type { MatchLibraryEntry } from "../replay/matchLibrary";
import type { MatchRoundBreakdown, MatchStatsPlayerRow, MatchStatsSideFilter, MatchStatsTeamTable } from "../replay/statsTypes";

type Props = {
  entry: MatchLibraryEntry;
  onBackToMatches: () => void;
  onOpenReplay: (id: string) => void;
};

type SortDirection = "asc" | "desc";
type StatsViewId = "summary" | "duels" | "utility" | "roles" | "advanced";
type Align = "left" | "right" | "center";

type StatsColumn = {
  id: string;
  label: string;
  width: string;
  align?: Align;
  title?: string;
  emphasis?: "primary" | "metric";
  groupStart?: boolean;
  sortValue?: (player: MatchStatsPlayerRow) => number | string;
  render: (player: MatchStatsPlayerRow) => React.ReactNode;
};

type StatsView = {
  id: StatsViewId;
  label: string;
  defaultSortKey: string;
  defaultSortDirection: SortDirection;
  gridTemplateColumns: string;
  minWidth: string;
  columns: StatsColumn[];
};

const SIDE_FILTERS: Array<{ label: string; value: MatchStatsSideFilter }> = [
  { label: "Both Sides", value: "all" },
  { label: "T Side", value: "T" },
  { label: "CT Side", value: "CT" },
];

const STATS_VIEWS: StatsView[] = [
  {
    id: "summary",
    label: "Summary",
    defaultSortKey: "rating",
    defaultSortDirection: "desc",
    gridTemplateColumns: "minmax(210px, 1.7fr) 116px 108px 62px 70px 70px 88px 96px 88px",
    minWidth: "908px",
    columns: [
      {
        id: "player",
        label: "Player",
        width: "minmax(210px, 1.7fr)",
        align: "left",
        emphasis: "primary",
        sortValue: (player) => player.displayName,
        render: renderPlayerCell,
      },
      {
        id: "rating",
        label: "HLTV Rating",
        width: "116px",
        align: "center",
        groupStart: true,
        emphasis: "metric",
        title:
          "Approximate HLTV 2.0-style estimate using KAST, KPR, DPR, ADR, and a Litepac impact proxy from opening kills, clutches, and multikills. Not the official HLTV formula.",
        sortValue: (player) => player.rating,
        render: renderRatingCell,
      },
      {
        id: "kad",
        label: "K / A / D",
        width: "108px",
        align: "center",
        sortValue: (player) => player.kills * 10000 + player.assists * 100 + player.deaths,
        render: renderKadCell,
      },
      { id: "kdRatio", label: "K/D", width: "62px", align: "right", sortValue: (player) => player.kdRatio, render: (player) => renderDecimal(player.kdRatio) },
      { id: "adr", label: "ADR", width: "70px", align: "right", sortValue: (player) => player.adr, render: (player) => renderDecimal(player.adr, 1) },
      { id: "kast", label: "KAST", width: "70px", align: "right", sortValue: (player) => player.kastPercentage, render: (player) => renderPercent(player.kastPercentage) },
      {
        id: "util",
        label: "Util Dmg",
        width: "88px",
        align: "center",
        groupStart: true,
        sortValue: (player) => player.utilityDamageTotal,
        render: (player) => renderStat(Math.round(player.utilityDamageTotal)),
      },
      {
        id: "openingDuels",
        label: "Op. Duels",
        width: "96px",
        align: "center",
        sortValue: (player) => player.openingDifferential,
        render: renderOpeningDuelsCell,
      },
      {
        id: "roundsPlayed",
        label: "Rounds",
        width: "88px",
        align: "right",
        sortValue: (player) => player.roundsPlayed,
        render: (player) => renderStat(player.roundsPlayed),
      },
    ],
  },
  {
    id: "duels",
    label: "Duels",
    defaultSortKey: "openingWinPercentage",
    defaultSortDirection: "desc",
    gridTemplateColumns: "minmax(196px, 1.45fr) 116px 74px 62px 62px 74px 70px 70px 76px minmax(160px, 1fr)",
    minWidth: "1004px",
    columns: [
      { id: "player", label: "Player", width: "minmax(196px, 1.45fr)", align: "left", emphasis: "primary", sortValue: (player) => player.displayName, render: renderPlayerCell },
      { id: "rating", label: "HLTV Rating", width: "116px", align: "center", groupStart: true, emphasis: "metric", sortValue: (player) => player.rating, render: renderRatingCell },
      { id: "openingAttempts", label: "Op. Att", width: "74px", align: "right", sortValue: (player) => player.openingAttempts, render: (player) => renderStat(player.openingAttempts) },
      { id: "openingKills", label: "Op. K", width: "62px", align: "right", sortValue: (player) => player.openingKills, render: (player) => renderStat(player.openingKills) },
      { id: "openingDeaths", label: "Op. D", width: "62px", align: "right", sortValue: (player) => player.openingDeaths, render: (player) => renderStat(player.openingDeaths) },
      { id: "openingDiff", label: "Op. +/-", width: "74px", align: "right", sortValue: (player) => player.openingDifferential, render: (player) => renderSigned(player.openingDifferential) },
      { id: "tradeKills", label: "Trade K", width: "70px", align: "right", groupStart: true, sortValue: (player) => player.tradeKills, render: (player) => renderStat(player.tradeKills) },
      { id: "tradedDeaths", label: "Traded D", width: "70px", align: "right", sortValue: (player) => player.tradedDeaths, render: (player) => renderStat(player.tradedDeaths) },
      { id: "tradeDiff", label: "Trade +/-", width: "78px", align: "right", sortValue: (player) => player.tradeDifferential, render: (player) => renderSigned(player.tradeDifferential) },
      { id: "topRival", label: "Top Rival", width: "minmax(160px, 1fr)", align: "left", groupStart: true, sortValue: (player) => player.topDuelRival ? player.topDuelRival.engagements : 0, render: renderTopRivalCell },
    ],
  },
  {
    id: "utility",
    label: "Utility",
    defaultSortKey: "utilityDamageTotal",
    defaultSortDirection: "desc",
    gridTemplateColumns: "minmax(196px, 1.35fr) 116px 82px 78px 78px 76px 82px 82px 62px 58px 50px 58px",
    minWidth: "1036px",
    columns: [
      { id: "player", label: "Player", width: "minmax(196px, 1.35fr)", align: "left", emphasis: "primary", sortValue: (player) => player.displayName, render: renderPlayerCell },
      { id: "rating", label: "HLTV Rating", width: "116px", align: "center", groupStart: true, emphasis: "metric", sortValue: (player) => player.rating, render: renderRatingCell },
      { id: "utilityDamageTotal", label: "Util Dmg", width: "82px", align: "center", groupStart: true, sortValue: (player) => player.utilityDamageTotal, render: (player) => renderStat(Math.round(player.utilityDamageTotal)) },
      { id: "heDamageTotal", label: "HE Dmg", width: "76px", align: "right", sortValue: (player) => player.heDamageTotal, render: (player) => renderStat(Math.round(player.heDamageTotal)) },
      { id: "fireDamageTotal", label: "Fire Dmg", width: "78px", align: "right", sortValue: (player) => player.fireDamageTotal, render: (player) => renderStat(Math.round(player.fireDamageTotal)) },
      { id: "flashAssists", label: "Flash Ast.", width: "78px", align: "right", sortValue: (player) => player.estimatedFlashAssists, render: (player) => renderStat(player.estimatedFlashAssists) },
      { id: "enemiesFlashed", label: "Flashed / Fl", width: "82px", align: "right", sortValue: (player) => player.enemiesFlashedPerFlash, render: (player) => renderDecimal(player.enemiesFlashedPerFlash, 2) },
      { id: "blindTimeSeconds", label: "Blind / Fl", width: "82px", align: "right", sortValue: (player) => player.blindSecondsPerFlash, render: (player) => renderDecimal(player.blindSecondsPerFlash, 2) },
      { id: "smokesThrown", label: "Smk", width: "58px", align: "right", groupStart: true, sortValue: (player) => player.smokesThrown, render: (player) => renderStat(player.smokesThrown) },
      { id: "flashbangsThrown", label: "Fl", width: "58px", align: "right", sortValue: (player) => player.flashbangsThrown, render: (player) => renderStat(player.flashbangsThrown) },
      { id: "heGrenadesThrown", label: "HE", width: "50px", align: "right", sortValue: (player) => player.heGrenadesThrown, render: (player) => renderStat(player.heGrenadesThrown) },
      { id: "fireGrenadesThrown", label: "Fire", width: "58px", align: "right", sortValue: (player) => player.fireGrenadesThrown, render: (player) => renderStat(player.fireGrenadesThrown) },
    ],
  },
  {
    id: "roles",
    label: "Roles / Style",
    defaultSortKey: "role",
    defaultSortDirection: "desc",
    gridTemplateColumns: "minmax(196px, 1.1fr) 160px 160px minmax(340px, 1.8fr)",
    minWidth: "920px",
    columns: [
      { id: "player", label: "Player", width: "minmax(196px, 1.35fr)", align: "left", emphasis: "primary", sortValue: (player) => player.displayName, render: renderPlayerCell },
      { id: "ctRole", label: "CT Role", width: "160px", align: "left", groupStart: true, emphasis: "metric", sortValue: (player) => player.role.ctTendency?.occupancyShare ?? 0, render: (player) => renderSideRoleCell(player, "CT") },
      { id: "tRole", label: "T Role", width: "160px", align: "left", groupStart: true, emphasis: "metric", sortValue: (player) => player.role.tTendency?.occupancyShare ?? 0, render: (player) => renderSideRoleCell(player, "T") },
      { id: "matchNote", label: "Match Note", width: "minmax(340px, 1.8fr)", align: "left", groupStart: true, sortValue: (player) => player.role.matchNote, render: renderRoleNoteCell },
    ],
  },
  {
    id: "advanced",
    label: "Advanced",
    defaultSortKey: "impact",
    defaultSortDirection: "desc",
    gridTemplateColumns: "minmax(196px, 1.45fr) 116px 72px 64px 76px 90px 84px 76px 58px 64px",
    minWidth: "1000px",
    columns: [
      { id: "player", label: "Player", width: "minmax(196px, 1.45fr)", align: "left", emphasis: "primary", sortValue: (player) => player.displayName, render: renderPlayerCell },
      { id: "rating", label: "HLTV Rating", width: "116px", align: "center", groupStart: true, emphasis: "metric", sortValue: (player) => player.rating, render: renderRatingCell },
      { id: "impact", label: "Impact", width: "72px", align: "right", groupStart: true, sortValue: (player) => player.impact, render: (player) => renderDecimal(player.impact) },
      { id: "kast", label: "KAST", width: "64px", align: "right", sortValue: (player) => player.kastPercentage, render: (player) => renderPercent(player.kastPercentage) },
      { id: "survival", label: "Survival", width: "76px", align: "right", sortValue: (player) => player.survivalPercentage, render: (player) => renderPercent(player.survivalPercentage) },
      { id: "clutch", label: "Clutch", width: "90px", align: "center", groupStart: true, sortValue: (player) => clutchScore(player), render: renderClutchCell },
      { id: "lastAlive", label: "Last Alive", width: "84px", align: "right", sortValue: (player) => player.lastAliveRounds, render: (player) => renderStat(player.lastAliveRounds) },
      { id: "sniperShare", label: "Sniper %", width: "76px", align: "right", sortValue: (player) => player.sniperKillShare, render: (player) => renderPercent(player.sniperKillShare) },
      { id: "plants", label: "Plant", width: "58px", align: "right", groupStart: true, sortValue: (player) => player.plants, render: (player) => renderStat(player.plants) },
      { id: "defuses", label: "Defuse", width: "64px", align: "right", sortValue: (player) => player.defuses, render: (player) => renderStat(player.defuses) },
    ],
  },
];

export function StatsPage({ entry, onBackToMatches, onOpenReplay }: Props) {
  const [sideFilter, setSideFilter] = useState<MatchStatsSideFilter>("all");
  const [viewId, setViewId] = useState<StatsViewId>("summary");
  const [sortKey, setSortKey] = useState<string>("rating");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const stats = useMemo(() => deriveMatchStats(entry.replay, sideFilter), [entry.replay, sideFilter]);
  const currentView = STATS_VIEWS.find((view) => view.id === viewId) ?? STATS_VIEWS[0];
  const activeSortColumn = currentView.columns.find((column) => column.id === sortKey && column.sortValue) ?? currentView.columns.find((column) => column.id === currentView.defaultSortKey);
  const activeSortKey = activeSortColumn?.id ?? currentView.defaultSortKey;

  const sortedTeams = useMemo(
    () =>
      stats.teams.map((team) => ({
        ...team,
        players: [...team.players].sort((left, right) => compareRows(left, right, activeSortColumn, sortDirection)),
      })),
    [activeSortColumn, sortDirection, stats.teams],
  );
  const headerWinner = sortedTeams[0];
  const headerRunnerUp = sortedTeams[1];

  return (
    <section className="stats-page">
      <header className="stats-header">
        <div
          className="stats-header-backdrop"
          style={{ backgroundImage: `linear-gradient(90deg, rgba(7, 11, 15, 0.84), rgba(7, 11, 15, 0.58) 38%, rgba(7, 11, 15, 0.84)), url(${entry.summary.mapImageUrl})` }}
        />
        <div className="stats-header-main">
          <div className="stats-heading">
            <div className="eyebrow">Match Stats</div>
            <div className="stats-match-band">
              <div className="stats-map-block">
                <h1>{entry.summary.mapName}</h1>
                <div className="stats-context-line">
                  <span>{entry.summary.addedLabel}</span>
                  <span>{entry.summary.sourceLabel}</span>
                  <span>{entry.replay.map.mapId}</span>
                </div>
              </div>
              <div className="stats-score-band">
                <div className="stats-team-mark">
                  <strong>{headerWinner?.teamName ?? entry.summary.teamAName}</strong>
                  <small>{headerWinner ? "Winner" : "Match final"}</small>
                </div>
                <span className="stats-score-value">
                  {headerWinner?.finalScore ?? entry.summary.teamAScore} - {headerRunnerUp?.finalScore ?? entry.summary.teamBScore}
                </span>
                <div className="stats-team-mark stats-team-mark-right">
                  <strong>{headerRunnerUp?.teamName ?? entry.summary.teamBName}</strong>
                  <small>{headerRunnerUp ? "Runner-up" : "Match final"}</small>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="stats-header-controls">
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

          <div className="stats-header-actions">
            <button type="button" className="stats-header-button stats-header-button-secondary" onClick={onBackToMatches}>
              Back to Matches
            </button>
            <button type="button" className="stats-header-button stats-header-button-primary" onClick={() => onOpenReplay(entry.id)}>
              Open 2D Replay
            </button>
          </div>
        </div>
      </header>

      <section className="stats-view-shell">
        <div className="stats-view-tabs" role="tablist" aria-label="Stats view">
          {STATS_VIEWS.map((view) => (
            <button
              key={view.id}
              type="button"
              role="tab"
              aria-selected={view.id === currentView.id}
              className={view.id === currentView.id ? "stats-view-tab stats-view-tab-active" : "stats-view-tab"}
              onClick={() => {
                setViewId(view.id);
                setSortKey(view.defaultSortKey);
                setSortDirection(view.defaultSortDirection);
              }}
            >
              {view.label}
            </button>
          ))}
        </div>
      </section>

      <div className="stats-team-grid">
        {sortedTeams.map((team) => (
          <section
            key={team.teamId}
            className={`stats-team-card ${team.isWinner ? "stats-team-card-winner" : "stats-team-card-trailing"}`}
          >
            <div className="stats-team-card-header">
              <div>
                <div className="card-title">{sideFilter === "all" ? (team.isWinner ? "Winner" : "Runner-up") : `${sideFilter} Focus`}</div>
                <strong>{team.teamName}</strong>
              </div>
              <span>{buildCompactTeamHeaderMeta(team, currentView)}</span>
            </div>

            <div className="stats-table">
              <div className="stats-table-scroll">
                <div
                  className="stats-table-head"
                  style={{ gridTemplateColumns: currentView.gridTemplateColumns, minWidth: currentView.minWidth }}
                >
                  {currentView.columns.map((column) => {
                    const isActive = column.id === activeSortKey;
                    const className = [
                      "stats-sort-head",
                      `stats-table-align-${column.align ?? "right"}`,
                      column.emphasis === "metric" ? "stats-sort-head-metric" : "",
                      column.groupStart ? "stats-table-group-start" : "",
                      isActive ? "stats-sort-head-active" : "",
                    ]
                      .filter(Boolean)
                      .join(" ");

                    return (
                      <button
                        key={column.id}
                        type="button"
                        className={className}
                        title={column.title}
                        onClick={() => {
                          if (!column.sortValue) {
                            return;
                          }

                          if (activeSortKey === column.id) {
                            setSortDirection((current) => (current === "desc" ? "asc" : "desc"));
                            return;
                          }

                          setSortKey(column.id);
                          setSortDirection(column.align === "left" ? "asc" : "desc");
                        }}
                      >
                        {column.label}
                      </button>
                    );
                  })}
                </div>

                <div className="stats-table-body">
                  {team.players.map((player) => (
                    <div
                      key={player.playerId}
                      className="stats-table-row"
                      style={{ gridTemplateColumns: currentView.gridTemplateColumns, minWidth: currentView.minWidth }}
                    >
                      {currentView.columns.map((column) => (
                        <div
                          key={column.id}
                          className={[
                            "stats-table-cell",
                            `stats-table-align-${column.align ?? "right"}`,
                            column.emphasis === "primary" ? "stats-table-cell-primary" : "",
                            column.emphasis === "metric" ? "stats-table-cell-metric" : "",
                            column.groupStart ? "stats-table-group-start" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          {column.render(player)}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        ))}
      </div>

      <section className="stats-rounds-card">
        <div className="stats-rounds-header">
          <div>
            <div className="card-title">Rounds</div>
            <strong>Round matrix</strong>
          </div>
          <span>Winner, survivors, score, and outcome per round</span>
        </div>

        <div className="stats-round-matrix">
          {stats.rounds.map((round, index) => (
            <RoundCell key={round.roundNumber} round={round} displayRoundNumber={index + 1} />
          ))}
        </div>
      </section>
    </section>
  );
}

function renderPlayerCell(player: MatchStatsPlayerRow) {
  return (
    <div className="stats-player-cell">
      <strong>{player.displayName}</strong>
      <small>{player.roundsPlayed} rounds</small>
    </div>
  );
}

function renderRatingCell(player: MatchStatsPlayerRow) {
  return (
    <div
      className="stats-rating-cell"
      title={`Approximate HLTV 2.0-style estimate. KAST ${player.kastPercentage.toFixed(1)}, KPR ${player.killsPerRound.toFixed(2)}, DPR ${player.deathsPerRound.toFixed(2)}, Impact ${player.impact.toFixed(2)}, ADR ${player.adr.toFixed(1)}.`}
    >
      {player.rating.toFixed(2)}
    </div>
  );
}

function renderKadCell(player: MatchStatsPlayerRow) {
  return (
    <div className="stats-kad-cell">
      <strong>
        {player.kills} / {player.assists} / {player.deaths}
      </strong>
    </div>
  );
}

function renderOpeningDuelsCell(player: MatchStatsPlayerRow) {
  return (
    <div className="stats-rival-cell">
      <strong>
        {player.openingKills} : {player.openingDeaths}
      </strong>
      <small>{formatSigned(player.openingDifferential)}</small>
    </div>
  );
}

function renderTopRivalCell(player: MatchStatsPlayerRow) {
  if (!player.topDuelRival) {
    return <span className="stats-muted">No repeated duel</span>;
  }

  const tooltip = player.topDuelRivals
    .map((rival) => `${rival.opponentName}: ${rival.kills}-${rival.deaths} (${rival.delta >= 0 ? "+" : ""}${rival.delta})`)
    .join(" | ");

  return (
    <div className="stats-rival-cell" title={tooltip}>
      <strong>{player.topDuelRival.opponentName}</strong>
      <small>
        {player.topDuelRival.kills}-{player.topDuelRival.deaths} · {player.topDuelRival.delta >= 0 ? "+" : ""}
        {player.topDuelRival.delta}
      </small>
    </div>
  );
}

function renderSideRoleCell(player: MatchStatsPlayerRow, side: "CT" | "T") {
  const tendency = side === "CT" ? player.role.ctTendency : player.role.tTendency;
  if (!tendency) {
    return <span className="stats-muted">Zone model unavailable</span>;
  }

  return (
    <div
      className="stats-role-cell"
      title={`${side} placement tendency from alive sample occupancy${tendency.zoneLabel ? ` · primary zone ${tendency.zoneLabel}` : ""}.`}
    >
      <strong>{tendency.label}</strong>
      <small>{tendency.zoneLabel ?? `${side} split too diffuse`}</small>
    </div>
  );
}

function renderRoleNoteCell(player: MatchStatsPlayerRow) {
  return (
    <div className="stats-role-note" title={player.role.notes.join(" ") || player.role.matchNote}>
      <span>{player.role.matchNote}</span>
    </div>
  );
}

function renderClutchCell(player: MatchStatsPlayerRow) {
  return (
    <div className="stats-rival-cell">
      <strong>
        {player.clutchWins}-{player.clutchAttempts}
      </strong>
      <small>W-A</small>
    </div>
  );
}

function renderStat(value: number) {
  return <span className="stats-stat-text">{value}</span>;
}

function renderDecimal(value: number, digits = 2) {
  return <span className="stats-stat-text">{value.toFixed(digits)}</span>;
}

function renderPercent(value: number, digits = 1) {
  return <span className="stats-stat-text">{value.toFixed(digits)}%</span>;
}

function renderSigned(value: number) {
  const className = value > 0 ? "stats-stat-text stats-stat-positive" : value < 0 ? "stats-stat-text stats-stat-negative" : "stats-stat-text";
  const label = value > 0 ? `+${value}` : `${value}`;
  return <span className={className}>{label}</span>;
}

function clutchScore(player: MatchStatsPlayerRow) {
  return player.clutchWins * 100 + player.clutchAttempts;
}


function buildCompactTeamHeaderMeta(team: MatchStatsTeamTable, currentView: StatsView) {
  const standout = buildTeamStandout(team, currentView);
  if (team.sideFilter === "all") {
    return standout ? `${team.finalScore} rounds won · ${standout}` : `${team.finalScore} rounds won`;
  }

  return standout ? `${team.sideFilter} split · ${standout}` : `${team.sideFilter} split · match final ${team.finalScore}`;
}

function buildTeamStandout(team: MatchStatsTeamTable, currentView: StatsView) {
  const players = team.players;
  if (players.length === 0) {
    return null;
  }

  if (currentView.id === "summary") {
    const player = pickTopPlayer(players, (entry) => entry.rating);
    return player ? `Top rating ${player.displayName} ${player.rating.toFixed(2)}` : null;
  }

  if (currentView.id === "duels") {
    const player = pickTopPlayer(players, (entry) => entry.openingDifferential);
    return player ? `Best opener ${player.displayName} ${formatSigned(player.openingDifferential)}` : null;
  }

  if (currentView.id === "utility") {
    const player = pickTopPlayer(players, (entry) => entry.utilityDamageTotal);
    return player ? `Most util damage ${player.displayName} ${Math.round(player.utilityDamageTotal)}` : null;
  }

  if (currentView.id === "roles") {
    const player = pickTopPlayer(players, (entry) => Math.max(entry.role.ctTendency?.occupancyShare ?? 0, entry.role.tTendency?.occupancyShare ?? 0));
    if (!player) {
      return null;
    }

    const strongest = (player.role.ctTendency?.occupancyShare ?? 0) >= (player.role.tTendency?.occupancyShare ?? 0) ? player.role.ctTendency : player.role.tTendency;
    return strongest ? `${player.displayName} ${strongest.label}` : null;
  }

  const player = pickTopPlayer(players, (entry) => entry.impact);
  return player ? `Highest impact ${player.displayName} ${player.impact.toFixed(2)}` : null;
}

function pickTopPlayer(players: MatchStatsPlayerRow[], score: (player: MatchStatsPlayerRow) => number) {
  let best: MatchStatsPlayerRow | null = null;
  let bestValue = Number.NEGATIVE_INFINITY;

  for (const player of players) {
    const value = score(player);
    if (value > bestValue) {
      best = player;
      bestValue = value;
    }
  }

  return best;
}

function formatSigned(value: number) {
  return value > 0 ? `+${value}` : `${value}`;
}

function compareRows(left: MatchStatsPlayerRow, right: MatchStatsPlayerRow, column: StatsColumn | undefined, sortDirection: SortDirection) {
  if (!column?.sortValue) {
    return left.displayName.localeCompare(right.displayName);
  }

  const leftValue = column.sortValue(left);
  const rightValue = column.sortValue(right);
  const factor = sortDirection === "desc" ? -1 : 1;

  if (typeof leftValue === "string" && typeof rightValue === "string") {
    const result = leftValue.localeCompare(rightValue);
    return result === 0 ? left.displayName.localeCompare(right.displayName) : factor * result;
  }

  const leftNumber = typeof leftValue === "number" ? leftValue : Number(leftValue);
  const rightNumber = typeof rightValue === "number" ? rightValue : Number(rightValue);
  if (leftNumber === rightNumber) {
    return left.displayName.localeCompare(right.displayName);
  }

  const result = leftNumber < rightNumber ? -1 : 1;
  return sortDirection === "desc" ? -result : result;
}

function RoundCell({ round, displayRoundNumber }: { round: MatchRoundBreakdown; displayRoundNumber: number }) {
  const outcomeLabel = round.defused ? "Defuse" : round.exploded ? "Explode" : round.planted ? "Plant" : round.endReason ?? "Win";
  const outcomeKind = deriveRoundOutcomeKind(round);
  const tooltipRoundText = round.roundNumber === displayRoundNumber ? `Round ${displayRoundNumber}` : `Round ${displayRoundNumber} (source round ${round.roundNumber})`;
  const showOutcomeIcon = outcomeKind !== "time";

  return (
    <div
      title={`${tooltipRoundText} | Winner: ${round.winnerSide ?? "Unknown"} | Score: ${round.scoreAfter.ct}-${round.scoreAfter.t} | Outcome: ${outcomeLabel} | Survivors CT ${round.ctSurvivors} / T ${round.tSurvivors}`}
      className={[
        "stats-round-cell",
        round.winnerSide === "CT" ? "stats-round-cell-ct" : "",
        round.winnerSide === "T" ? "stats-round-cell-t" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {showOutcomeIcon ? (
        <span className={`stats-round-cell-outcome-watermark stats-round-cell-outcome-watermark-${outcomeKind}`} aria-hidden="true">
          <RoundOutcomeIcon kind={outcomeKind} />
        </span>
      ) : null}
      <div className="stats-round-cell-content">
        <div className="stats-round-cell-topline">
          <span className="stats-round-cell-number">R{displayRoundNumber}</span>
        </div>
        <strong className="stats-round-cell-score">{round.scoreAfter.ct}-{round.scoreAfter.t}</strong>
        <div className="stats-round-cell-survivors">
          <div className="stats-round-survivor-row stats-round-survivor-row-ct" aria-hidden="true">
            {Array.from({ length: 5 }, (_, index) => (
              <span key={`ct-${index}`} className={index < round.ctSurvivors ? "stats-round-survivor-dot stats-round-survivor-dot-active" : "stats-round-survivor-dot"} />
            ))}
          </div>
          <div className="stats-round-survivor-row stats-round-survivor-row-t" aria-hidden="true">
            {Array.from({ length: 5 }, (_, index) => (
              <span key={`t-${index}`} className={index < round.tSurvivors ? "stats-round-survivor-dot stats-round-survivor-dot-active" : "stats-round-survivor-dot"} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

type RoundOutcomeKind = "elimination" | "bomb" | "defuse" | "time";

function deriveRoundOutcomeKind(round: MatchRoundBreakdown): RoundOutcomeKind {
  if (round.defused) {
    return "defuse";
  }

  if (round.exploded || round.planted) {
    return "bomb";
  }

  if (round.winnerSide === "CT" && round.tSurvivors === 0) {
    return "elimination";
  }

  if (round.winnerSide === "T" && round.ctSurvivors === 0) {
    return "elimination";
  }

  return "time";
}

function RoundOutcomeIcon({ kind }: { kind: RoundOutcomeKind }) {
  if (kind === "bomb") {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path fill="currentColor" d="M10 1.8 12 6.2 16.9 5.1 14.3 9.1 18.2 12.3 13.3 12.9 13 18l-3-4-4.3 2.5 1.4-4.7-4.2-2.9 4.8-.8 1.4-4.6Z" />
      </svg>
    );
  }

  if (kind === "defuse") {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path fill="currentColor" d="M15.5 2.1a4.4 4.4 0 0 0-4.8 6.2l-6.6 6.6a2 2 0 1 0 2.8 2.8l6.6-6.6a4.4 4.4 0 0 0 6.2-4.8l-3 2.1-2.4-2.4 2.1-3Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path
        fill="currentColor"
        d="M10 2.2c-3.2 0-5.8 2.5-5.8 5.6 0 1.9 1 3.5 2.5 4.5v2.4h2.1v-1.6h2.4v1.6h2.1v-2.4c1.5-1 2.5-2.6 2.5-4.5 0-3.1-2.6-5.6-5.8-5.6Zm-2 4.8a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm4 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z"
      />
      <rect x="8.2" y="14.3" width="3.6" height="1.3" fill="currentColor" />
    </svg>
  );
}
