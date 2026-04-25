import { teamName, type Side } from "./derived";
import { inferPlayerRole } from "./roleInference";
import { accumulateStreamZoneOccupancy, createEmptySideZoneTallies, deriveSideRoleTendency } from "./positionalRoles";
import type { Replay } from "./types";
import type { HeadToHeadDuel, MatchStatsPlayerRow, MatchStatsSideFilter, MatchStatsSnapshot } from "./statsTypes";
import { utilityKindFromWeaponName } from "./weapons";
export type { HeadToHeadDuel, MatchRoundBreakdown, MatchStatsPlayerRow, MatchStatsSideFilter, MatchStatsSnapshot, MatchStatsTeamTable } from "./statsTypes";

const TRADE_WINDOW_SECONDS = 5;

export function deriveMatchStats(replay: Replay, sideFilter: MatchStatsSideFilter): MatchStatsSnapshot {
  const playerTeam = new Map(replay.players.map((player) => [player.playerId, player.teamId]));
  const playerName = new Map(replay.players.map((player) => [player.playerId, player.displayName]));
  const tickRate = replay.match.tickRate > 0 ? replay.match.tickRate : replay.sourceDemo.tickRate;
  const tradeWindowTicks = Math.max(1, Math.round(tickRate * TRADE_WINDOW_SECONDS));
  const finalScores = deriveTeamScores(replay, playerTeam);
  const orderedTeams = replay.teams
    .slice(0, 2)
    .sort((left, right) => {
      const scoreDiff = (finalScores.get(right.teamId) ?? 0) - (finalScores.get(left.teamId) ?? 0);
      if (scoreDiff !== 0) {
        return scoreDiff;
      }

      return teamName(replay, left.teamId).localeCompare(teamName(replay, right.teamId));
    });

  const teamTables = orderedTeams.map((team, index) => ({
    sideFilter,
    teamId: team.teamId,
    teamName: teamName(replay, team.teamId),
    finalScore: finalScores.get(team.teamId) ?? 0,
    isWinner: index === 0,
    players: replay.players
      .filter((player) => player.teamId === team.teamId)
      .map((player) => createEmptyPlayerRow(player.playerId, player.displayName)),
  }));
  const playerRows = new Map(teamTables.flatMap((team) => team.players.map((player) => [player.playerId, player])));
  const playerZoneTallies = new Map(replay.players.map((player) => [player.playerId, createEmptySideZoneTallies()]));
  const duelLedger = new Map<string, Map<string, { kills: number; deaths: number }>>();

  for (const round of replay.rounds) {
    const relevantStreams = round.playerStreams.filter((stream) => stream.side != null && (sideFilter === "all" || stream.side === sideFilter));
    const relevantPlayers = new Set(relevantStreams.map((stream) => stream.playerId));
    const roundKillCounts = new Map<string, number>();
    const roundContributors = new Set<string>();
    const roundSurvivors = new Set<string>();
    const tradeSummary = deriveTradeSummary(round.killEvents, playerTeam, tradeWindowTicks);
    const clutchSummary = deriveClutchSummary(round, playerTeam);

    for (const stream of relevantStreams) {
      const row = playerRows.get(stream.playerId);
      if (!row) {
        continue;
      }

      row.roundsPlayed += 1;
      if (isAliveAtRoundEnd(stream)) {
        row.roundsSurvived += 1;
        roundSurvivors.add(stream.playerId);
      }

      const zoneTally = playerZoneTallies.get(stream.playerId);
      if (zoneTally) {
        accumulateStreamZoneOccupancy(replay.map, round, stream, zoneTally, tickRate);
      }
    }

    const openingKill = round.killEvents.find((event) => isCrossTeamKillEvent(event, playerTeam));
    if (openingKill?.killerPlayerId && relevantPlayers.has(openingKill.killerPlayerId)) {
      const killerRow = playerRows.get(openingKill.killerPlayerId);
      if (killerRow) {
        killerRow.openingKills += 1;
        killerRow.openingAttempts += 1;
      }
    }

    if (openingKill && relevantPlayers.has(openingKill.victimPlayerId)) {
      const victimRow = playerRows.get(openingKill.victimPlayerId);
      if (victimRow) {
        victimRow.openingDeaths += 1;
        victimRow.openingAttempts += 1;
      }
    }

    for (const event of round.killEvents) {
      if (event.killerPlayerId && relevantPlayers.has(event.killerPlayerId)) {
        const killerRow = playerRows.get(event.killerPlayerId);
        if (killerRow) {
          killerRow.kills += 1;
          roundContributors.add(event.killerPlayerId);
          roundKillCounts.set(event.killerPlayerId, (roundKillCounts.get(event.killerPlayerId) ?? 0) + 1);
          if (event.isHeadshot) {
            killerRow.headshotKills += 1;
          }
          if (isSniperWeapon(event.weaponName)) {
            killerRow.sniperKills += 1;
          }
        }
      }

      if (event.assisterPlayerId && relevantPlayers.has(event.assisterPlayerId)) {
        const assisterRow = playerRows.get(event.assisterPlayerId);
        if (assisterRow) {
          assisterRow.assists += 1;
          roundContributors.add(event.assisterPlayerId);
        }
      }

      if (relevantPlayers.has(event.victimPlayerId)) {
        const victimRow = playerRows.get(event.victimPlayerId);
        if (victimRow) {
          victimRow.deaths += 1;
        }
      }

      if (event.killerPlayerId && isCrossTeamKillEvent(event, playerTeam)) {
        recordDuel(duelLedger, event.killerPlayerId, event.victimPlayerId);
      }
    }

    for (const [playerId, count] of tradeSummary.tradeKills) {
      if (!relevantPlayers.has(playerId)) {
        continue;
      }
      const row = playerRows.get(playerId);
      if (row) {
        row.tradeKills += count;
      }
    }

    for (const [playerId, count] of tradeSummary.tradedDeaths) {
      if (!relevantPlayers.has(playerId)) {
        continue;
      }
      const row = playerRows.get(playerId);
      if (row) {
        row.tradedDeaths += count;
      }
    }

    for (const playerId of clutchSummary.lastAlivePlayers) {
      if (!relevantPlayers.has(playerId)) {
        continue;
      }
      const row = playerRows.get(playerId);
      if (row) {
        row.lastAliveRounds += 1;
      }
    }

    for (const playerId of clutchSummary.clutchAttemptPlayers) {
      if (!relevantPlayers.has(playerId)) {
        continue;
      }
      const row = playerRows.get(playerId);
      if (row) {
        row.clutchAttempts += 1;
      }
    }

    for (const playerId of clutchSummary.clutchWinPlayers) {
      if (!relevantPlayers.has(playerId)) {
        continue;
      }
      const row = playerRows.get(playerId);
      if (row) {
        row.clutchWins += 1;
      }
    }

    for (const playerId of relevantPlayers) {
      const row = playerRows.get(playerId);
      if (!row) {
        continue;
      }

      if (roundContributors.has(playerId) || roundSurvivors.has(playerId) || (tradeSummary.tradedDeaths.get(playerId) ?? 0) > 0) {
        row.kastPercentage += 1;
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
        row.utilityDamageTotal += event.healthDamageTaken;
        const utilityKind = utilityKindFromWeaponName(event.weaponName) ?? (event.weaponName.toLowerCase() === "inferno" ? "molotov" : null);
        if (utilityKind === "hegrenade") {
          row.heDamageTotal += event.healthDamageTaken;
        } else if (utilityKind === "molotov" || utilityKind === "incendiary") {
          row.fireDamageTotal += event.healthDamageTaken;
        } else if (event.weaponName.toLowerCase() === "inferno") {
          row.fireDamageTotal += event.healthDamageTaken;
        }
      }
    }

    for (const blindEvent of round.blindEvents) {
      if (!blindEvent.attackerPlayerId || !relevantPlayers.has(blindEvent.attackerPlayerId)) {
        continue;
      }

      const attackerTeam = playerTeam.get(blindEvent.attackerPlayerId);
      const victimTeam = playerTeam.get(blindEvent.playerId);
      if (!attackerTeam || !victimTeam || attackerTeam === victimTeam) {
        continue;
      }

      const row = playerRows.get(blindEvent.attackerPlayerId);
      if (!row) {
        continue;
      }

      row.enemiesFlashed += 1;
      row.blindTimeSeconds += blindEvent.durationTicks / tickRate;
      if (isEstimatedFlashAssist(blindEvent, round.killEvents, playerTeam)) {
        row.estimatedFlashAssists += 1;
      }
    }

    for (const utility of round.utilityEntities) {
      if (!utility.throwerPlayerId || !relevantPlayers.has(utility.throwerPlayerId)) {
        continue;
      }

      const row = playerRows.get(utility.throwerPlayerId);
      if (!row) {
        continue;
      }

      if (utility.kind === "flashbang") {
        row.flashbangsThrown += 1;
      } else if (utility.kind === "smoke") {
        row.smokesThrown += 1;
      } else if (utility.kind === "hegrenade") {
        row.heGrenadesThrown += 1;
      } else if (utility.kind === "molotov" || utility.kind === "incendiary") {
        row.fireGrenadesThrown += 1;
      } else if (utility.kind === "decoy") {
        row.decoysThrown += 1;
      }
    }

    for (const event of round.bombEvents) {
      if (!event.playerId || !relevantPlayers.has(event.playerId)) {
        continue;
      }

      const row = playerRows.get(event.playerId);
      if (!row) {
        continue;
      }

      if (event.type === "planted") {
        row.plants += 1;
      } else if (event.type === "defused") {
        row.defuses += 1;
      }
    }

    for (const [playerId, killsThisRound] of roundKillCounts) {
      const row = playerRows.get(playerId);
      if (!row) {
        continue;
      }

      if (killsThisRound === 2) {
        row.multiKills2k += 1;
      } else if (killsThisRound === 3) {
        row.multiKills3k += 1;
      } else if (killsThisRound === 4) {
        row.multiKills4k += 1;
      } else if (killsThisRound >= 5) {
        row.multiKills5k += 1;
      }
    }
  }

  for (const row of playerRows.values()) {
    const zoneTallies = playerZoneTallies.get(row.playerId) ?? createEmptySideZoneTallies();
    const ctTendency = deriveSideRoleTendency(replay.map, "CT", zoneTallies.CT);
    const tTendency = deriveSideRoleTendency(replay.map, "T", zoneTallies.T);

    row.kdRatio = row.deaths === 0 ? row.kills : row.kills / row.deaths;
    row.killsPerRound = row.roundsPlayed === 0 ? 0 : row.kills / row.roundsPlayed;
    row.deathsPerRound = row.roundsPlayed === 0 ? 0 : row.deaths / row.roundsPlayed;
    row.adr = row.roundsPlayed === 0 ? 0 : row.adr / row.roundsPlayed;
    row.headshotPercentage = row.kills === 0 ? 0 : (row.headshotKills / row.kills) * 100;
    row.kastPercentage = row.roundsPlayed === 0 ? 0 : (row.kastPercentage / row.roundsPlayed) * 100;
    row.openingWinPercentage = row.openingAttempts === 0 ? 0 : (row.openingKills / row.openingAttempts) * 100;
    row.openingDifferential = row.openingKills - row.openingDeaths;
    row.sniperKillShare = row.kills === 0 ? 0 : (row.sniperKills / row.kills) * 100;
    row.survivalPercentage = row.roundsPlayed === 0 ? 0 : (row.roundsSurvived / row.roundsPlayed) * 100;
    row.tradeDifferential = row.tradeKills - row.tradedDeaths;
    row.utilityDamagePerRound = row.roundsPlayed === 0 ? 0 : row.utilityDamageTotal / row.roundsPlayed;
    row.blindSecondsPerFlash = row.flashbangsThrown === 0 ? 0 : row.blindTimeSeconds / row.flashbangsThrown;
    row.enemiesFlashedPerFlash = row.flashbangsThrown === 0 ? 0 : row.enemiesFlashed / row.flashbangsThrown;
    row.heDamagePerGrenade = row.heGrenadesThrown === 0 ? 0 : row.heDamageTotal / row.heGrenadesThrown;
    row.fireDamagePerGrenade = row.fireGrenadesThrown === 0 ? 0 : row.fireDamageTotal / row.fireGrenadesThrown;
    row.impact = derivePlayerImpact(row);
    row.rating = derivePlayerRating(row);
    row.role = inferPlayerRole({
      assists: row.assists,
      blindTimeSeconds: row.blindTimeSeconds,
      ctTendency,
      clutchAttempts: row.clutchAttempts,
      clutchWins: row.clutchWins,
      enemiesFlashed: row.enemiesFlashed,
      flashAssistsEstimated: row.estimatedFlashAssists,
      impact: row.impact,
      killsPerRound: row.killsPerRound,
      lastAliveRounds: row.lastAliveRounds,
      multiKills2k: row.multiKills2k,
      multiKills3k: row.multiKills3k,
      multiKills4k: row.multiKills4k,
      multiKills5k: row.multiKills5k,
      openingAttempts: row.openingAttempts,
      openingDeaths: row.openingDeaths,
      openingKills: row.openingKills,
      roundsPlayed: row.roundsPlayed,
      sniperKills: row.sniperKills,
      sniperKillShare: row.sniperKillShare,
      tradeKills: row.tradeKills,
      tradedDeaths: row.tradedDeaths,
      tTendency,
      utilityDamageTotal: row.utilityDamageTotal,
    });
    row.topDuelRival = deriveTopDuelRival(row.playerId, duelLedger, playerName);
    row.topDuelRivals = deriveTopDuelRivals(row.playerId, duelLedger, playerName);
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
      ctSurvivors: countRoundSurvivors(round, "CT"),
      tSurvivors: countRoundSurvivors(round, "T"),
    })),
    teams: teamTables,
  };
}

function createEmptyPlayerRow(playerId: string, displayName: string): MatchStatsPlayerRow {
  return {
    playerId,
    displayName,
    assists: 0,
    adr: 0,
    blindTimeSeconds: 0,
    blindSecondsPerFlash: 0,
    clutchAttempts: 0,
    clutchWins: 0,
    deaths: 0,
    deathsPerRound: 0,
    decoysThrown: 0,
    defuses: 0,
    enemiesFlashed: 0,
    enemiesFlashedPerFlash: 0,
    estimatedFlashAssists: 0,
    fireDamagePerGrenade: 0,
    fireDamageTotal: 0,
    fireGrenadesThrown: 0,
    flashbangsThrown: 0,
    headshotKills: 0,
    headshotPercentage: 0,
    heDamagePerGrenade: 0,
    heDamageTotal: 0,
    heGrenadesThrown: 0,
    impact: 0,
    kastPercentage: 0,
    kdRatio: 0,
    kills: 0,
    killsPerRound: 0,
    lastAliveRounds: 0,
    multiKills2k: 0,
    multiKills3k: 0,
    multiKills4k: 0,
    multiKills5k: 0,
    openingAttempts: 0,
    openingDeaths: 0,
    openingDifferential: 0,
    openingKills: 0,
    openingWinPercentage: 0,
    plants: 0,
    rating: 0,
    role: inferPlayerRole({
      assists: 0,
      blindTimeSeconds: 0,
      clutchAttempts: 0,
      clutchWins: 0,
      enemiesFlashed: 0,
      flashAssistsEstimated: 0,
      impact: 0,
      killsPerRound: 0,
      lastAliveRounds: 0,
      multiKills2k: 0,
      multiKills3k: 0,
      multiKills4k: 0,
      multiKills5k: 0,
      openingAttempts: 0,
      openingDeaths: 0,
      openingKills: 0,
      roundsPlayed: 0,
      sniperKills: 0,
      sniperKillShare: 0,
      tradeKills: 0,
      tradedDeaths: 0,
      ctTendency: null,
      tTendency: null,
      utilityDamageTotal: 0,
    }),
    roundsPlayed: 0,
    roundsSurvived: 0,
    smokesThrown: 0,
    sniperKillShare: 0,
    sniperKills: 0,
    survivalPercentage: 0,
    topDuelRival: null,
    topDuelRivals: [],
    tradeDifferential: 0,
    tradeKills: 0,
    tradedDeaths: 0,
    utilityDamagePerRound: 0,
    utilityDamageTotal: 0,
  };
}

function deriveTradeSummary(
  killEvents: Replay["rounds"][number]["killEvents"],
  playerTeam: Map<string, string>,
  tradeWindowTicks: number,
) {
  const tradeKills = new Map<string, number>();
  const tradedDeaths = new Map<string, number>();
  const tradedVictimIndexes = new Set<number>();

  for (let index = 1; index < killEvents.length; index += 1) {
    const currentEvent = killEvents[index];
    if (!currentEvent.killerPlayerId || !isCrossTeamKillEvent(currentEvent, playerTeam)) {
      continue;
    }

    for (let previousIndex = index - 1; previousIndex >= 0; previousIndex -= 1) {
      const previousEvent = killEvents[previousIndex];
      if (currentEvent.tick - previousEvent.tick > tradeWindowTicks) {
        break;
      }

      if (!previousEvent.killerPlayerId || tradedVictimIndexes.has(previousIndex)) {
        continue;
      }

      if (previousEvent.killerPlayerId !== currentEvent.victimPlayerId) {
        continue;
      }

      const previousVictimTeam = playerTeam.get(previousEvent.victimPlayerId);
      const currentKillerTeam = playerTeam.get(currentEvent.killerPlayerId);
      if (!previousVictimTeam || !currentKillerTeam || previousVictimTeam !== currentKillerTeam) {
        continue;
      }

      tradeKills.set(currentEvent.killerPlayerId, (tradeKills.get(currentEvent.killerPlayerId) ?? 0) + 1);
      tradedDeaths.set(previousEvent.victimPlayerId, (tradedDeaths.get(previousEvent.victimPlayerId) ?? 0) + 1);
      tradedVictimIndexes.add(previousIndex);
      break;
    }
  }

  return {
    tradeKills,
    tradedDeaths,
  };
}

function deriveClutchSummary(round: Replay["rounds"][number], playerTeam: Map<string, string>) {
  const lastAlivePlayers = new Set<string>();
  const clutchAttemptPlayers = new Set<string>();
  const clutchWinPlayers = new Set<string>();
  const inspectionTicks = Array.from(new Set([...round.killEvents.map((event) => event.tick + 1), round.endTick])).sort((left, right) => left - right);

  for (const tick of inspectionTicks) {
    const aliveByTeam = alivePlayersByTeamAtTick(round, playerTeam, tick);
    const teamEntries = Array.from(aliveByTeam.entries());

    for (const [teamId, alivePlayers] of teamEntries) {
      const opponentAliveCount = teamEntries.reduce((sum, [candidateTeamId, candidatePlayers]) => {
        if (candidateTeamId === teamId) {
          return sum;
        }

        return sum + candidatePlayers.size;
      }, 0);

      if (alivePlayers.size === 1 && opponentAliveCount >= 1) {
        const [lonePlayerId] = alivePlayers;
        if (lonePlayerId) {
          lastAlivePlayers.add(lonePlayerId);
          if (opponentAliveCount > 1) {
            clutchAttemptPlayers.add(lonePlayerId);
          }
        }
      }
    }
  }

  if (round.winnerSide != null) {
    const winnerTeamId = teamIdForRoundSide(round, round.winnerSide, playerTeam);
    if (winnerTeamId) {
      const finalAliveByTeam = alivePlayersByTeamAtTick(round, playerTeam, round.endTick);
      const finalWinnerAlive = finalAliveByTeam.get(winnerTeamId) ?? new Set<string>();

      for (const playerId of clutchAttemptPlayers) {
        if (playerTeam.get(playerId) === winnerTeamId && finalWinnerAlive.has(playerId)) {
          clutchWinPlayers.add(playerId);
        }
      }
    }
  }

  return {
    lastAlivePlayers,
    clutchAttemptPlayers,
    clutchWinPlayers,
  };
}

function alivePlayersByTeamAtTick(round: Replay["rounds"][number], playerTeam: Map<string, string>, tick: number) {
  const aliveByTeam = new Map<string, Set<string>>();

  for (const stream of round.playerStreams) {
    const teamId = playerTeam.get(stream.playerId);
    if (!teamId || !isPlayerAliveAtTick(stream, tick)) {
      continue;
    }

    let teamPlayers = aliveByTeam.get(teamId);
    if (!teamPlayers) {
      teamPlayers = new Set<string>();
      aliveByTeam.set(teamId, teamPlayers);
    }

    teamPlayers.add(stream.playerId);
  }

  return aliveByTeam;
}

function isPlayerAliveAtTick(stream: Replay["rounds"][number]["playerStreams"][number], tick: number) {
  const index = Math.max(0, Math.min(stream.alive.length - 1, tick - stream.sampleOriginTick));
  return stream.alive[index] ?? false;
}

function isAliveAtRoundEnd(stream: Replay["rounds"][number]["playerStreams"][number]) {
  for (let index = stream.alive.length - 1; index >= 0; index -= 1) {
    const sample = stream.alive[index];
    if (sample == null) {
      continue;
    }

    return sample;
  }

  return false;
}

function isEstimatedFlashAssist(
  blindEvent: Replay["rounds"][number]["blindEvents"][number],
  killEvents: Replay["rounds"][number]["killEvents"],
  playerTeam: Map<string, string>,
) {
  if (!blindEvent.attackerPlayerId) {
    return false;
  }

  const attackerTeam = playerTeam.get(blindEvent.attackerPlayerId);
  if (!attackerTeam) {
    return false;
  }

  for (const killEvent of killEvents) {
    if (killEvent.tick < blindEvent.tick || killEvent.tick > blindEvent.endTick) {
      continue;
    }

    if (!killEvent.killerPlayerId || killEvent.victimPlayerId !== blindEvent.playerId || killEvent.killerPlayerId === blindEvent.attackerPlayerId) {
      continue;
    }

    if (playerTeam.get(killEvent.killerPlayerId) === attackerTeam) {
      return true;
    }
  }

  return false;
}

function isUtilityDamageWeapon(weaponName: string) {
  const kind = utilityKindFromWeaponName(weaponName);
  return kind === "hegrenade" || kind === "molotov" || kind === "incendiary" || weaponName.toLowerCase() === "inferno";
}

function isSniperWeapon(weaponName: string) {
  const normalized = weaponName
    .replace(/^weapon_/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return normalized === "awp" || normalized === "ssg08" || normalized === "g3sg1" || normalized === "scar20";
}

function isCrossTeamKillEvent(event: Replay["rounds"][number]["killEvents"][number], playerTeam: Map<string, string>) {
  if (!event.killerPlayerId) {
    return false;
  }

  const killerTeam = playerTeam.get(event.killerPlayerId);
  const victimTeam = playerTeam.get(event.victimPlayerId);
  return killerTeam != null && victimTeam != null && killerTeam !== victimTeam;
}

function recordDuel(duelLedger: Map<string, Map<string, { kills: number; deaths: number }>>, killerPlayerId: string, victimPlayerId: string) {
  const killerEntries = duelLedger.get(killerPlayerId) ?? new Map<string, { kills: number; deaths: number }>();
  duelLedger.set(killerPlayerId, killerEntries);
  const killerEntry = killerEntries.get(victimPlayerId) ?? { kills: 0, deaths: 0 };
  killerEntry.kills += 1;
  killerEntries.set(victimPlayerId, killerEntry);

  const victimEntries = duelLedger.get(victimPlayerId) ?? new Map<string, { kills: number; deaths: number }>();
  duelLedger.set(victimPlayerId, victimEntries);
  const victimEntry = victimEntries.get(killerPlayerId) ?? { kills: 0, deaths: 0 };
  victimEntry.deaths += 1;
  victimEntries.set(killerPlayerId, victimEntry);
}

function deriveTopDuelRival(playerId: string, duelLedger: Map<string, Map<string, { kills: number; deaths: number }>>, playerName: Map<string, string>) {
  return deriveTopDuelRivals(playerId, duelLedger, playerName)[0] ?? null;
}

function deriveTopDuelRivals(
  playerId: string,
  duelLedger: Map<string, Map<string, { kills: number; deaths: number }>>,
  playerName: Map<string, string>,
): HeadToHeadDuel[] {
  const rivals = Array.from(duelLedger.get(playerId)?.entries() ?? []);
  if (rivals.length === 0) {
    return [];
  }

  rivals.sort((left, right) => {
    const leftTotal = left[1].kills + left[1].deaths;
    const rightTotal = right[1].kills + right[1].deaths;
    if (leftTotal !== rightTotal) {
      return rightTotal - leftTotal;
    }

    if (left[1].kills !== right[1].kills) {
      return right[1].kills - left[1].kills;
    }

    return (playerName.get(left[0]) ?? left[0]).localeCompare(playerName.get(right[0]) ?? right[0]);
  });

  return rivals.slice(0, 3).map(([opponentPlayerId, ledger]) => ({
    opponentName: playerName.get(opponentPlayerId) ?? opponentPlayerId,
    kills: ledger.kills,
    deaths: ledger.deaths,
    engagements: ledger.kills + ledger.deaths,
    delta: ledger.kills - ledger.deaths,
  }));
}

function derivePlayerRating(row: MatchStatsPlayerRow) {
  const rating =
    0.0073 * row.kastPercentage +
    0.3591 * row.killsPerRound -
    0.5329 * row.deathsPerRound +
    0.2372 * row.impact +
    0.0032 * row.adr +
    0.1587;

  return Math.round(Math.max(0, rating) * 100) / 100;
}

function derivePlayerImpact(row: MatchStatsPlayerRow) {
  if (row.roundsPlayed === 0) {
    return 0;
  }

  const openingKillRate = row.openingKills / row.roundsPlayed;
  const openingDeathRate = row.openingDeaths / row.roundsPlayed;
  const multiKillPressure =
    (row.multiKills2k * 0.4 +
      row.multiKills3k * 0.8 +
      row.multiKills4k * 1.2 +
      row.multiKills5k * 1.6) /
    row.roundsPlayed;
  const clutchPressure = (row.clutchAttempts * 0.35 + row.clutchWins * 0.8) / row.roundsPlayed;

  const impact = 0.85 + openingKillRate * 1.9 - openingDeathRate * 0.7 + multiKillPressure + clutchPressure;
  return Math.round(clamp(impact, 0.2, 2.5) * 100) / 100;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function countRoundSurvivors(round: Replay["rounds"][number], side: Side) {
  let survivors = 0;
  for (const stream of round.playerStreams) {
    if (stream.side !== side || stream.alive.length === 0) {
      continue;
    }

    for (let index = stream.alive.length - 1; index >= 0; index -= 1) {
      const sample = stream.alive[index];
      if (sample == null) {
        continue;
      }

      if (sample) {
        survivors += 1;
      }
      break;
    }
  }

  return survivors;
}

function deriveTeamScores(replay: Replay, playerTeam: Map<string, string>) {
  const wins = new Map<string, number>(replay.teams.map((team) => [team.teamId, 0]));

  for (const round of replay.rounds) {
    if (round.winnerSide == null) {
      continue;
    }

    const winnerTeamId = teamIdForRoundSide(round, round.winnerSide, playerTeam);
    if (!winnerTeamId) {
      continue;
    }

    wins.set(winnerTeamId, (wins.get(winnerTeamId) ?? 0) + 1);
  }

  return wins;
}

function teamIdForRoundSide(round: Replay["rounds"][number], side: Side, playerTeam: Map<string, string>) {
  const counts = new Map<string, number>();

  for (const stream of round.playerStreams) {
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
