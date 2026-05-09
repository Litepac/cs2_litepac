import { formatWeaponLabel } from "./weapons";
import type { Replay, Round } from "./types";

const TRADE_WINDOW_SECONDS = 5;
const NEARBY_TEAMMATE_DISTANCE_UNITS = 700;
const VICTIM_PATH_SECONDS = 10;

export type DeathReviewEntry = {
  assisterName: string | null;
  headshot: boolean;
  key: string;
  killerFlashed: boolean | null;
  killerName: string;
  killerPlayerId: string | null;
  killerX: number | null;
  killerY: number | null;
  nearbyTeammates: number | null;
  roundIndex: number;
  roundNumber: number;
  tick: number;
  timeDisplay: string | null;
  tradeState: "traded" | "untraded" | "unknown";
  tradeTickDelaySeconds: number | null;
  victimFlashed: boolean | null;
  victimName: string;
  victimPath: Array<{ x: number; y: number }>;
  victimPlayerId: string;
  victimSide: "CT" | "T" | null;
  victimUtilityCount: number | null;
  victimX: number | null;
  victimY: number | null;
  weaponLabel: string;
};

export function collectDeathReviewEntries(
  replay: Replay,
  activeRoundIndex: number,
): DeathReviewEntry[] {
  const round = replay.rounds[activeRoundIndex];
  if (!round) {
    return [];
  }

  return round.killEvents.map((event, index) => buildDeathReviewEntry(replay, round, activeRoundIndex, event, index));
}

function buildDeathReviewEntry(
  replay: Replay,
  round: Round,
  roundIndex: number,
  event: Round["killEvents"][number],
  eventIndex: number,
): DeathReviewEntry {
  const tickRate = replay.match.tickRate || replay.sourceDemo.tickRate || 64;
  const victimSide = resolvePlayerSide(round, event.victimPlayerId);
  const trade = resolveTradeState(round, event, victimSide, tickRate);

  return {
    assisterName: playerName(replay, event.assisterPlayerId),
    headshot: event.isHeadshot,
    key: deathReviewKey(round.roundNumber, event, eventIndex),
    killerFlashed: event.killerPlayerId ? isPlayerFlashedAtTick(round, event.killerPlayerId, event.tick) : null,
    killerName: playerName(replay, event.killerPlayerId) ?? "World",
    killerPlayerId: event.killerPlayerId,
    killerX: event.killerX,
    killerY: event.killerY,
    nearbyTeammates: countNearbyTeammates(round, event),
    roundIndex,
    roundNumber: round.roundNumber,
    tick: event.tick,
    timeDisplay: formatRoundClock(replay, round, event.tick),
    tradeState: trade.state,
    tradeTickDelaySeconds: trade.delaySeconds,
    victimFlashed: isPlayerFlashedAtTick(round, event.victimPlayerId, event.tick),
    victimName: playerName(replay, event.victimPlayerId) ?? "Unknown",
    victimPath: collectVictimPath(round, event, tickRate),
    victimPlayerId: event.victimPlayerId,
    victimSide,
    victimUtilityCount: countUtilityAtTick(round, event.victimPlayerId, event.tick - 1),
    victimX: event.victimX,
    victimY: event.victimY,
    weaponLabel: formatWeaponLabel(event.weaponName),
  };
}

function isPlayerFlashedAtTick(round: Round, playerId: string, tick: number) {
  return round.blindEvents.some((event) => event.playerId === playerId && event.tick <= tick && event.endTick >= tick);
}

function deathReviewKey(roundNumber: number, event: Round["killEvents"][number], eventIndex: number) {
  return `death:${roundNumber}:${event.tick}:${event.victimPlayerId}:${eventIndex}`;
}

function playerName(replay: Replay, playerId: string | null) {
  if (!playerId) {
    return null;
  }

  return replay.players.find((player) => player.playerId === playerId)?.displayName ?? null;
}

function resolvePlayerSide(round: Round, playerId: string | null) {
  if (!playerId) {
    return null;
  }

  return round.playerStreams.find((stream) => stream.playerId === playerId)?.side ?? null;
}

function resolveTradeState(
  round: Round,
  deathEvent: Round["killEvents"][number],
  victimSide: "CT" | "T" | null,
  tickRate: number,
): { state: DeathReviewEntry["tradeState"]; delaySeconds: number | null } {
  if (!deathEvent.killerPlayerId || !victimSide || !Number.isFinite(tickRate) || tickRate <= 0) {
    return { state: "unknown", delaySeconds: null };
  }

  const killerSide = resolvePlayerSide(round, deathEvent.killerPlayerId);
  if (!killerSide || killerSide === victimSide) {
    return { state: "unknown", delaySeconds: null };
  }

  const tradeWindowTicks = Math.round(TRADE_WINDOW_SECONDS * tickRate);
  const trade = round.killEvents.find((event) => {
    if (event.tick <= deathEvent.tick || event.tick - deathEvent.tick > tradeWindowTicks) {
      return false;
    }

    if (event.victimPlayerId !== deathEvent.killerPlayerId) {
      return false;
    }

    return resolvePlayerSide(round, event.killerPlayerId) === victimSide;
  });

  if (!trade) {
    return { state: "untraded", delaySeconds: null };
  }

  return {
    state: "traded",
    delaySeconds: Math.round(((trade.tick - deathEvent.tick) / tickRate) * 10) / 10,
  };
}

function countNearbyTeammates(round: Round, event: Round["killEvents"][number]) {
  if (event.victimX == null || event.victimY == null) {
    return null;
  }

  const victimSide = resolvePlayerSide(round, event.victimPlayerId);
  if (!victimSide) {
    return null;
  }

  let count = 0;
  for (const stream of round.playerStreams) {
    if (stream.playerId === event.victimPlayerId || stream.side !== victimSide) {
      continue;
    }

    const sample = sampleAtTick(stream, event.tick);
    if (!sample?.alive || sample.x == null || sample.y == null) {
      continue;
    }

    if (Math.hypot(sample.x - event.victimX, sample.y - event.victimY) <= NEARBY_TEAMMATE_DISTANCE_UNITS) {
      count += 1;
    }
  }

  return count;
}

function countUtilityAtTick(round: Round, playerId: string, tick: number) {
  const stream = round.playerStreams.find((entry) => entry.playerId === playerId);
  if (!stream) {
    return null;
  }

  const sampleIntervalTicks = Math.max(1, stream.sampleIntervalTicks || 1);
  const sampleIndex = Math.round((tick - stream.sampleOriginTick) / sampleIntervalTicks);
  if (sampleIndex < 0 || sampleIndex >= stream.x.length) {
    return null;
  }

  const counts = [
    stream.flashbangs[sampleIndex],
    stream.smokes[sampleIndex],
    stream.heGrenades[sampleIndex],
    stream.fireGrenades[sampleIndex],
    stream.decoys[sampleIndex],
  ];
  if (counts.every((count) => count == null)) {
    return null;
  }

  let total = 0;
  for (const count of counts) {
    total += count ?? 0;
  }
  return total;
}

function collectVictimPath(
  round: Round,
  event: Round["killEvents"][number],
  tickRate: number,
) {
  const stream = round.playerStreams.find((entry) => entry.playerId === event.victimPlayerId);
  if (!stream || !Number.isFinite(tickRate) || tickRate <= 0) {
    return [];
  }

  const startTick = Math.max(stream.sampleOriginTick, event.tick - Math.round(VICTIM_PATH_SECONDS * tickRate));
  const stepTicks = Math.max(4, Math.round(tickRate / 4));
  const path: Array<{ x: number; y: number }> = [];
  for (let tick = startTick; tick <= event.tick; tick += stepTicks) {
    const sample = sampleAtTick(stream, tick);
    if (!sample || sample.x == null || sample.y == null) {
      continue;
    }

    const previous = path[path.length - 1];
    if (previous && Math.hypot(previous.x - sample.x, previous.y - sample.y) < 18) {
      continue;
    }

    path.push({ x: sample.x, y: sample.y });
  }

  if (event.victimX != null && event.victimY != null) {
    const previous = path[path.length - 1];
    if (!previous || Math.hypot(previous.x - event.victimX, previous.y - event.victimY) >= 18) {
      path.push({ x: event.victimX, y: event.victimY });
    }
  }

  return path;
}

function sampleAtTick(stream: Round["playerStreams"][number], tick: number) {
  const sampleIntervalTicks = Math.max(1, stream.sampleIntervalTicks || 1);
  const sampleIndex = Math.round((tick - stream.sampleOriginTick) / sampleIntervalTicks);
  if (sampleIndex < 0 || sampleIndex >= stream.x.length) {
    return null;
  }

  return {
    alive: stream.alive[sampleIndex] ?? false,
    x: stream.x[sampleIndex] ?? null,
    y: stream.y[sampleIndex] ?? null,
  };
}

function formatRoundClock(replay: Replay, round: Round, tick: number) {
  const tickRate = replay.match.tickRate || replay.sourceDemo.tickRate || 0;
  const roundTimeSeconds = replay.match.roundTimeSeconds ?? null;
  const freezeEndTick = round.freezeEndTick ?? round.startTick;
  if (!Number.isFinite(tickRate) || tickRate <= 0 || roundTimeSeconds == null || roundTimeSeconds <= 0) {
    return null;
  }

  const elapsedSeconds = Math.max(0, (tick - freezeEndTick) / tickRate);
  const remainingSeconds = Math.max(0, roundTimeSeconds - elapsedSeconds);
  const totalSeconds = Math.floor(Math.round(remainingSeconds * 10) / 10);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
