import type { RoleArchetype, RoleInferenceResult, SideRoleTendency } from "./statsTypes";

export type RoleInferenceInput = {
  assists: number;
  blindTimeSeconds: number;
  clutchAttempts: number;
  clutchWins: number;
  enemiesFlashed: number;
  flashAssistsEstimated: number;
  impact: number;
  killsPerRound: number;
  lastAliveRounds: number;
  multiKills2k: number;
  multiKills3k: number;
  multiKills4k: number;
  multiKills5k: number;
  openingAttempts: number;
  openingDeaths: number;
  openingKills: number;
  roundsPlayed: number;
  sniperKills: number;
  sniperKillShare: number;
  tradeKills: number;
  tradedDeaths: number;
  utilityDamageTotal: number;
  ctTendency: SideRoleTendency | null;
  tTendency: SideRoleTendency | null;
};

export function inferPlayerRole(input: RoleInferenceInput): RoleInferenceResult {
  if (input.roundsPlayed <= 0) {
    return {
      primaryRole: "Balanced",
      secondaryRole: null,
      confidence: 0,
      matchNote: "No round participation available for this match.",
      contextLabel: null,
      ctTendency: null,
      tTendency: null,
      scores: emptyScores(),
      notes: ["No round participation available."],
    };
  }

  const roundsPlayed = input.roundsPlayed;
  const openingKillRate = input.openingKills / roundsPlayed;
  const openingDeathRate = input.openingDeaths / roundsPlayed;
  const openingAttemptRate = input.openingAttempts / roundsPlayed;
  const tradeKillRate = input.tradeKills / roundsPlayed;
  const tradedDeathRate = input.tradedDeaths / roundsPlayed;
  const supportAssistRate = input.assists / roundsPlayed;
  const flashAssistRate = input.flashAssistsEstimated / roundsPlayed;
  const flashedEnemyRate = input.enemiesFlashed / roundsPlayed;
  const blindSecondsRate = input.blindTimeSeconds / roundsPlayed;
  const utilityDamageRate = input.utilityDamageTotal / roundsPlayed;
  const clutchAttemptRate = input.clutchAttempts / roundsPlayed;
  const clutchWinRate = input.clutchWins / roundsPlayed;
  const lastAliveRate = input.lastAliveRounds / roundsPlayed;
  const sniperShare = input.sniperKillShare / 100;
  const openingDifferential = input.openingKills - input.openingDeaths;
  const multikillPressure =
    (input.multiKills2k * 0.45 + input.multiKills3k * 0.9 + input.multiKills4k * 1.3 + input.multiKills5k * 1.7) /
    roundsPlayed;

  const scores = [
    {
      label: "Opener" as const,
      score: openingAttemptRate * 100 + openingKillRate * 120 - openingDeathRate * 28 + input.killsPerRound * 22,
    },
    {
      label: "Trader" as const,
      score: tradeKillRate * 105 + tradedDeathRate * 42 + supportAssistRate * 18 + input.killsPerRound * 14,
    },
    {
      label: "Closer" as const,
      score: clutchAttemptRate * 125 + clutchWinRate * 200 + lastAliveRate * 55 + multikillPressure * 26,
    },
    {
      label: "AWPer" as const,
      score: sniperShare * 145 + input.killsPerRound * 18 + input.impact * 7,
    },
    {
      label: "Utility Support" as const,
      score:
        utilityDamageRate * 1.15 +
        flashAssistRate * 95 +
        flashedEnemyRate * 10 +
        blindSecondsRate * 17 +
        supportAssistRate * 16,
    },
  ].map((entry) => ({ ...entry, score: roundScore(entry.score) }));

  scores.sort((left, right) => right.score - left.score);
  const eligibleRoles = scores.filter((entry) =>
    hasRoleEvidence(entry.label, {
      blindSecondsRate,
      clutchAttempts: input.clutchAttempts,
      clutchWins: input.clutchWins,
      flashAssistRate,
      flashAssistsEstimated: input.flashAssistsEstimated,
      openingAttempts: input.openingAttempts,
      openingDifferential,
      sniperKills: input.sniperKills,
      sniperSharePercent: input.sniperKillShare,
      tradeKills: input.tradeKills,
      tradedDeaths: input.tradedDeaths,
      utilityDamageRate,
    }),
  );
  const primaryEligible = eligibleRoles[0];
  const runnerUpEligible = eligibleRoles[1];
  const primaryRole =
    primaryEligible == null || primaryEligible.score < 26
      ? "Balanced"
      : primaryEligible.label;
  const secondaryRole =
    primaryRole === "Balanced" || runnerUpEligible == null || runnerUpEligible.score < 22 || primaryEligible.score - runnerUpEligible.score > 14
      ? null
      : runnerUpEligible.label;
  const confidence =
    primaryRole === "Balanced"
      ? 32
      : Math.round(
          clamp(
            52 +
              Math.min(22, primaryEligible.score / 4.8) +
              clamp((primaryEligible.score - (runnerUpEligible?.score ?? 0)) * 1.4, 0, 18),
            0,
            95,
          ),
        );

  const notes = buildRoleNotes(primaryRole, secondaryRole, {
    blindSecondsRate,
    clutchAttemptRate,
    clutchWinRate,
    flashAssistRate,
    multikillPressure,
    openingAttemptRate,
    openingKillRate,
    sniperShare,
    tradeKillRate,
    utilityDamageRate,
  });
  const matchNote = buildMatchNote(primaryRole, secondaryRole, {
    blindSecondsRate,
    clutchAttempts: input.clutchAttempts,
    clutchWins: input.clutchWins,
    ctTendency: input.ctTendency,
    enemiesFlashed: input.enemiesFlashed,
    flashAssistsEstimated: input.flashAssistsEstimated,
    openingDifferential: input.openingKills - input.openingDeaths,
    openingAttempts: input.openingAttempts,
    sniperSharePercent: Math.round(sniperShare * 100),
    sniperKills: input.sniperKills,
    tTendency: input.tTendency,
    tradeKills: input.tradeKills,
    tradedDeaths: input.tradedDeaths,
    utilityDamageRate,
  });

  return {
    primaryRole,
    secondaryRole,
    confidence,
    matchNote,
    contextLabel: null,
    ctTendency: input.ctTendency,
    tTendency: input.tTendency,
    scores,
    notes,
  };
}

function buildRoleNotes(
  primaryRole: RoleArchetype,
  secondaryRole: RoleArchetype | null,
  rates: {
    blindSecondsRate: number;
    clutchAttemptRate: number;
    clutchWinRate: number;
    flashAssistRate: number;
    multikillPressure: number;
    openingAttemptRate: number;
    openingKillRate: number;
    sniperShare: number;
    tradeKillRate: number;
    utilityDamageRate: number;
  },
) {
  const notes: string[] = [];

  if (primaryRole === "Opener") {
    notes.push(`High first-contact rate (${formatPerRound(rates.openingAttemptRate)} attempts/round)`);
    if (rates.openingKillRate > 0) {
      notes.push(`Converts ${formatPerRound(rates.openingKillRate)} opening kills per round`);
    }
  } else if (primaryRole === "Trader") {
    notes.push(`Trade involvement is strong (${formatPerRound(rates.tradeKillRate)} trade kills/round)`);
  } else if (primaryRole === "Closer") {
    notes.push(`Late-round leverage shows up in clutch pressure (${formatPerRound(rates.clutchAttemptRate)} attempts/round)`);
    if (rates.clutchWinRate > 0) {
      notes.push(`Converts some of that pressure into wins (${formatPerRound(rates.clutchWinRate)} clutch wins/round)`);
    }
  } else if (primaryRole === "AWPer") {
    notes.push(`Sniper share is elevated (${Math.round(rates.sniperShare * 100)}% of kills)`);
  } else if (primaryRole === "Utility Support") {
    notes.push(`Utility impact is elevated (${Math.round(rates.utilityDamageRate)} util damage/round)`);
    if (rates.flashAssistRate > 0 || rates.blindSecondsRate > 0) {
      notes.push(`Flash contribution is meaningful (${formatPerRound(rates.flashAssistRate)} flash assists/round)`);
    }
  } else {
    notes.push("No single match role signal dominated strongly enough.");
  }

  if (secondaryRole) {
    notes.push(`Secondary tendency: ${secondaryRole}`);
  }

  if (rates.multikillPressure > 0.2) {
    notes.push("Multikill pressure is above baseline.");
  }

  return notes;
}

function buildMatchNote(
  primaryRole: RoleArchetype,
  secondaryRole: RoleArchetype | null,
  stats: {
    blindSecondsRate: number;
    clutchAttempts: number;
    clutchWins: number;
    ctTendency: SideRoleTendency | null;
    enemiesFlashed: number;
    flashAssistsEstimated: number;
    openingDifferential: number;
    openingAttempts: number;
    sniperKills: number;
    sniperSharePercent: number;
    tTendency: SideRoleTendency | null;
    tradeKills: number;
    tradedDeaths: number;
    utilityDamageRate: number;
  },
) {
  const placementFallback = buildPlacementNote(stats.ctTendency, stats.tTendency);
  let summary: string;

  switch (primaryRole) {
    case "Opener":
      summary = `Opening load ${formatSigned(stats.openingDifferential)} over ${stats.openingAttempts} attempts.`;
      break;
    case "Trader":
      summary = `Trade game ${stats.tradeKills} trade kills, ${stats.tradedDeaths} traded deaths.`;
      break;
    case "Closer":
      summary = `Late-round pressure ${stats.clutchWins} of ${stats.clutchAttempts} clutches converted.`;
      break;
    case "AWPer":
      summary = `Sniper share ${stats.sniperSharePercent}% from ${stats.sniperKills} sniper kills.`;
      break;
    case "Utility Support":
      if (stats.flashAssistsEstimated >= 2 || (stats.enemiesFlashed >= 8 && stats.blindSecondsRate >= 1.2)) {
        summary = `Flash pressure ${stats.enemiesFlashed} flashed, ${stats.blindSecondsRate.toFixed(1)} blind sec/round.`;
      } else if (stats.utilityDamageRate >= 7) {
        summary = `Utility pressure ${stats.utilityDamageRate.toFixed(1)} util damage/round.`;
      } else {
        summary = placementFallback;
      }
      break;
    default:
      summary = placementFallback;
      break;
  }

  if (secondaryRole && primaryRole !== "Balanced" && summary !== placementFallback) {
    summary += ` Secondary: ${secondaryRole}.`;
  }

  return summary;
}

function buildPlacementNote(ctTendency: SideRoleTendency | null, tTendency: SideRoleTendency | null) {
  const ctLabel = placementPhrase(ctTendency, "CT");
  const tLabel = placementPhrase(tTendency, "T");

  if (ctLabel && tLabel) {
    return `CT ${ctLabel} · T ${tLabel}.`;
  }

  if (ctLabel) {
    return `CT ${ctLabel}.`;
  }

  if (tLabel) {
    return `T ${tLabel}.`;
  }

  return "No clear single tendency in this match.";
}

function placementPhrase(tendency: SideRoleTendency | null, side: "CT" | "T") {
  if (!tendency || tendency.label === "Allround") {
    return null;
  }

  if (tendency.zoneLabel) {
    return tendency.zoneLabel;
  }

  return side === "CT" ? tendency.label.replace("Anchor", "anchor").replace("Rotation", "rotation") : tendency.label.toLowerCase();
}

function hasRoleEvidence(
  role: Exclude<RoleArchetype, "Balanced">,
  stats: {
    blindSecondsRate: number;
    clutchAttempts: number;
    clutchWins: number;
    flashAssistRate: number;
    flashAssistsEstimated: number;
    openingAttempts: number;
    openingDifferential: number;
    sniperKills: number;
    sniperSharePercent: number;
    tradeKills: number;
    tradedDeaths: number;
    utilityDamageRate: number;
  },
) {
  switch (role) {
    case "Opener":
      return stats.openingAttempts >= 4 && (stats.openingDifferential >= 1 || stats.openingAttempts >= 6);
    case "Trader":
      return stats.tradeKills >= 3 && stats.tradeKills + stats.tradedDeaths >= 5;
    case "Closer":
      return stats.clutchAttempts >= 3 || (stats.clutchWins >= 1 && stats.clutchAttempts >= 2);
    case "AWPer":
      return stats.sniperKills >= 6 && stats.sniperSharePercent >= 32;
    case "Utility Support":
      return (
        stats.utilityDamageRate >= 7 ||
        stats.flashAssistsEstimated >= 3 ||
        (stats.flashAssistRate >= 0.16 && stats.blindSecondsRate >= 0.9)
      );
  }
}

function emptyScores(): Array<{ label: Exclude<RoleArchetype, "Balanced">; score: number }> {
  return [
    { label: "Opener", score: 0 },
    { label: "Trader", score: 0 },
    { label: "Closer", score: 0 },
    { label: "AWPer", score: 0 },
    { label: "Utility Support", score: 0 },
  ];
}

function formatPerRound(value: number) {
  return value.toFixed(2);
}

function formatSigned(value: number) {
  return value > 0 ? `+${value}` : `${value}`;
}

function roundScore(value: number) {
  return Math.round(clamp(value, 0, 100) * 10) / 10;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
