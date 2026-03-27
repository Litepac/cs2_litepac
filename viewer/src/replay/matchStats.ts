import { teamName, type Side } from "./derived";
import type { Replay, Round } from "./types";

export type MatchStatsSideFilter = "all" | Side;

export type MatchStatsPlayerRow = {
  playerId: string;
  displayName: string;
  assists: number;
  adr: number;
  deaths: number;
  kast: number;
  kdDiff: number;
  kdRatio: number;
  kills: number;
  openingDuelsLosses: number;
  openingDuelsWins: number;
  roundsPlayed: number;
  utilityDamage: number;
};

export type MatchStatsTeamTable = {
  sideFilter: MatchStatsSideFilter;
  teamId: string;
  teamName: string;
  players: MatchStatsPlayerRow[];
};

export type MatchRoundBreakdown = {
  roundNumber: number;
  winnerSide: "T" | "CT" | null;
  scoreAfter: { ct: number; t: number };
  endReason: string | null;
  planted: boolean;
  defused: boolean;
  exploded: boolean;
};

export type MatchStatsSnapshot = {
  rounds: MatchRoundBreakdown[];
  teams: MatchStatsTeamTable[];
};

const TRADE_WINDOW_SECONDS = 5;
const UTILITY_DAMAGE_WEAPONS = new Set(["hegrenade", "inferno", "molotov", "incgrenade", "incendiary"]);

export function deriveMatchStats(replay: Replay, sideFilter: MatchStatsSideFilter): MatchStatsSnapshot {
  const playerTeam = new Map(replay.players.map((player) => [player.playerId, player.teamId]));
  const teamTables = replay.teams.slice(0, 2).map((team) => ({
    sideFilter,
    teamId: team.teamId,
    teamName: teamName(replay, team.teamId),
    players: replay.players
      .filter((player) => player.teamId === team.teamId)
      .map((player) => ({
        playerId: player.playerId,
        displayName: player.displayName,
        assists: 0,
        adr: 0,
        deaths: 0,
        kast: 0,
        kdDiff: 0,
        kdRatio: 0,
        kills: 0,
        openingDuelsLosses: 0,
        openingDuelsWins: 0,
        roundsPlayed: 0,
        utilityDamage: 0,
      })),
  }));
  const playerRows = new Map(teamTables.flatMap((team) => team.players.map((player) => [player.playerId, player])));
  const playerKastRounds = new Map<string, number>();
  const tradeWindowTicks = Math.max(1, Math.round(replay.match.tickRate * TRADE_WINDOW_SECONDS));

  for (const round of replay.rounds) {
    const relevantStreams = round.playerStreams.filter((stream) => stream.side != null && (sideFilter === "all" || stream.side === sideFilter));
    const relevantPlayers = new Set(relevantStreams.map((stream) => stream.playerId));
    const roundFlags = new Map<string, { assist: boolean; kill: boolean; survived: boolean; traded: boolean }>();

    for (const stream of relevantStreams) {
      const row = playerRows.get(stream.playerId);
      if (!row) {
        continue;
      }

      row.roundsPlayed += 1;
      roundFlags.set(stream.playerId, {
        assist: false,
        kill: false,
        survived: lastAliveSample(stream.alive),
        traded: false,
      });
    }

    const openingDuel = round.killEvents.find((event) => {
      if (!event.killerPlayerId || !event.victimPlayerId) {
        return false;
      }

      const killerTeam = playerTeam.get(event.killerPlayerId);
      const victimTeam = playerTeam.get(event.victimPlayerId);
      return killerTeam != null && victimTeam != null && killerTeam !== victimTeam;
    });

    if (openingDuel?.killerPlayerId) {
      const killerRow = playerRows.get(openingDuel.killerPlayerId);
      if (killerRow && relevantPlayers.has(openingDuel.killerPlayerId)) {
        killerRow.openingDuelsWins += 1;
      }
    }

    if (openingDuel?.victimPlayerId) {
      const victimRow = playerRows.get(openingDuel.victimPlayerId);
      if (victimRow && relevantPlayers.has(openingDuel.victimPlayerId)) {
        victimRow.openingDuelsLosses += 1;
      }
    }

    for (const event of round.killEvents) {
      if (event.killerPlayerId && relevantPlayers.has(event.killerPlayerId)) {
        const killerRow = playerRows.get(event.killerPlayerId);
        if (killerRow) {
          killerRow.kills += 1;
          roundFlags.get(event.killerPlayerId)?.kill && (roundFlags.get(event.killerPlayerId)!.kill = true);
          const flags = roundFlags.get(event.killerPlayerId);
          if (flags) {
            flags.kill = true;
          }
        }
      }

      if (event.assisterPlayerId && relevantPlayers.has(event.assisterPlayerId)) {
        const assisterRow = playerRows.get(event.assisterPlayerId);
        if (assisterRow) {
          assisterRow.assists += 1;
          const flags = roundFlags.get(event.assisterPlayerId);
          if (flags) {
            flags.assist = true;
          }
        }
      }

      if (relevantPlayers.has(event.victimPlayerId)) {
        const victimRow = playerRows.get(event.victimPlayerId);
        if (victimRow) {
          victimRow.deaths += 1;
        }
      }
    }

    for (const event of round.hurtEvents) {
      if (!event.attackerPlayerId || !relevantPlayers.has(event.attackerPlayerId)) {
        continue;
      }

      const attackerTeam = playerTeam.get(event.attackerPlayerId);
      const victimTeam = event.victimPlayerId ? playerTeam.get(event.victimPlayerId) : null;
      if (attackerTeam != null && victimTeam != null && attackerTeam === victimTeam) {
        continue;
      }

      const row = playerRows.get(event.attackerPlayerId);
      if (!row) {
        continue;
      }

      row.adr += event.healthDamageTaken;
      if (isUtilityDamageWeapon(event.weaponName)) {
        row.utilityDamage += event.healthDamageTaken;
      }
    }

    for (const event of round.killEvents) {
      if (!relevantPlayers.has(event.victimPlayerId) || !event.killerPlayerId) {
        continue;
      }

      const victimTeam = playerTeam.get(event.victimPlayerId);
      if (!victimTeam) {
        continue;
      }

      const traded = round.killEvents.some((candidate) => {
        if (candidate.tick <= event.tick || candidate.tick > event.tick + tradeWindowTicks) {
          return false;
        }

        if (!candidate.killerPlayerId || candidate.victimPlayerId !== event.killerPlayerId) {
          return false;
        }

        return playerTeam.get(candidate.killerPlayerId) === victimTeam;
      });

      if (traded) {
        const flags = roundFlags.get(event.victimPlayerId);
        if (flags) {
          flags.traded = true;
        }
      }
    }

    for (const [playerId, flags] of roundFlags) {
      if (flags.kill || flags.assist || flags.survived || flags.traded) {
        playerKastRounds.set(playerId, (playerKastRounds.get(playerId) ?? 0) + 1);
      }
    }
  }

  for (const row of playerRows.values()) {
    row.kdDiff = row.kills - row.deaths;
    row.kdRatio = row.deaths === 0 ? row.kills : row.kills / row.deaths;
    row.adr = row.roundsPlayed === 0 ? 0 : row.adr / row.roundsPlayed;
    row.utilityDamage = row.roundsPlayed === 0 ? 0 : row.utilityDamage / row.roundsPlayed;
    row.kast = row.roundsPlayed === 0 ? 0 : ((playerKastRounds.get(row.playerId) ?? 0) / row.roundsPlayed) * 100;
  }

  return {
    rounds: replay.rounds.map((round) => ({
      roundNumber: round.roundNumber,
      winnerSide: round.winnerSide,
      scoreAfter: round.scoreAfter,
      endReason: round.endReason,
      planted: round.bombEvents.some((event) => event.type === "planted"),
      defused: round.bombEvents.some((event) => event.type === "defused"),
      exploded: round.bombEvents.some((event) => event.type === "exploded"),
    })),
    teams: teamTables,
  };
}

function isUtilityDamageWeapon(weaponName: string) {
  return UTILITY_DAMAGE_WEAPONS.has(weaponName.toLowerCase());
}

function lastAliveSample(alive: Round["playerStreams"][number]["alive"]) {
  for (let index = alive.length - 1; index >= 0; index -= 1) {
    const value = alive[index];
    if (typeof value === "boolean") {
      return value;
    }
  }

  return false;
}
