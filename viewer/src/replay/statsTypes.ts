import type { Side } from "./derived";

export type MatchStatsSideFilter = "all" | Side;

export type RoleArchetype =
  | "Opener"
  | "Trader"
  | "Closer"
  | "AWPer"
  | "Utility Support"
  | "Balanced";

export type SideRoleTendency = {
  label: string;
  zoneLabel: string | null;
  occupancyShare: number;
};

export type RoleInferenceResult = {
  primaryRole: RoleArchetype;
  secondaryRole: RoleArchetype | null;
  confidence: number;
  matchNote: string;
  contextLabel: string | null;
  ctTendency: SideRoleTendency | null;
  tTendency: SideRoleTendency | null;
  scores: Array<{ label: Exclude<RoleArchetype, "Balanced">; score: number }>;
  notes: string[];
};

export type HeadToHeadDuel = {
  opponentName: string;
  kills: number;
  deaths: number;
  engagements: number;
  delta: number;
};

export type MatchStatsPlayerRow = {
  playerId: string;
  displayName: string;
  assists: number;
  adr: number;
  blindTimeSeconds: number;
  blindSecondsPerFlash: number;
  clutchAttempts: number;
  clutchWins: number;
  deaths: number;
  deathsPerRound: number;
  decoysThrown: number;
  defuses: number;
  enemiesFlashed: number;
  enemiesFlashedPerFlash: number;
  estimatedFlashAssists: number;
  fireDamagePerGrenade: number;
  fireDamageTotal: number;
  fireGrenadesThrown: number;
  flashbangsThrown: number;
  headshotKills: number;
  headshotPercentage: number;
  heDamagePerGrenade: number;
  heDamageTotal: number;
  heGrenadesThrown: number;
  impact: number;
  kastPercentage: number;
  kdRatio: number;
  kills: number;
  killsPerRound: number;
  lastAliveRounds: number;
  multiKills2k: number;
  multiKills3k: number;
  multiKills4k: number;
  multiKills5k: number;
  openingAttempts: number;
  openingDeaths: number;
  openingDifferential: number;
  openingKills: number;
  openingWinPercentage: number;
  plants: number;
  rating: number;
  role: RoleInferenceResult;
  roundsPlayed: number;
  roundsSurvived: number;
  smokesThrown: number;
  sniperKillShare: number;
  sniperKills: number;
  survivalPercentage: number;
  topDuelRival: HeadToHeadDuel | null;
  topDuelRivals: HeadToHeadDuel[];
  tradeDifferential: number;
  tradeKills: number;
  tradedDeaths: number;
  utilityDamagePerRound: number;
  utilityDamageTotal: number;
};

export type MatchStatsTeamTable = {
  sideFilter: MatchStatsSideFilter;
  teamId: string;
  teamName: string;
  finalScore: number;
  isWinner: boolean;
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
  ctSurvivors: number;
  tSurvivors: number;
};

export type MatchStatsSnapshot = {
  rounds: MatchRoundBreakdown[];
  teams: MatchStatsTeamTable[];
};
