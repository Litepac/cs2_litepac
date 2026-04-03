import { readFileSync } from "node:fs";
import path from "node:path";

const replayPath = path.resolve(
  process.argv.slice(2).find((arg) => !arg.startsWith("--")) ?? "assets/fixtures/Mirage.replay.json",
);
const replay = JSON.parse(readFileSync(replayPath, "utf-8"));
const tickRate = Math.max(1, replay.match?.tickRate || replay.sourceDemo?.tickRate || 64);
const playerById = new Map((replay.players ?? []).map((player) => [player.playerId, player]));
const offsetsSeconds = [0, 5, 10, 20];

console.log(`Replay: ${path.relative(process.cwd(), replayPath)} :: ${replay.map?.mapId ?? "unknown"}`);
console.log(`Rounds: ${replay.rounds?.length ?? 0}`);

for (const offsetSeconds of offsetsSeconds) {
  const offsetTicks = Math.round(offsetSeconds * tickRate);
  const snapshots = collectPositionPlayerSnapshots(replay, [], "all", offsetTicks, false);
  const ctSnapshots = collectPositionPlayerSnapshots(replay, [], "CT", offsetTicks, false);
  const tSnapshots = collectPositionPlayerSnapshots(replay, [], "T", offsetTicks, false);
  const sideSwapPlayer = findPlayerWithBothSides(replay);
  const selectedCtSnapshots = sideSwapPlayer
    ? collectPositionPlayerSnapshots(replay, [{ playerIds: [sideSwapPlayer.playerId], side: "CT" }], "CT", offsetTicks, false)
    : [];
  const selectedTSnapshots = sideSwapPlayer
    ? collectPositionPlayerSnapshots(replay, [{ playerIds: [sideSwapPlayer.playerId], side: "T" }], "T", offsetTicks, false)
    : [];
  const compareSelections = resolveCompareSelections(replay);
  const compareSnapshots = collectPositionPlayerSnapshots(replay, compareSelections, "all", offsetTicks, false);

  const ctMismatches = ctSnapshots.filter((snapshot) => snapshot.side !== "CT").length;
  const tMismatches = tSnapshots.filter((snapshot) => snapshot.side !== "T").length;
  const selectedCtMismatches = selectedCtSnapshots.filter((snapshot) => snapshot.side !== "CT").length;
  const selectedTMismatches = selectedTSnapshots.filter((snapshot) => snapshot.side !== "T").length;
  const compareSelectionKeys = new Set(
    compareSelections.flatMap((selection) => selection.playerIds.map((playerId) => toSelectionKey(playerId, selection.side))),
  );
  const compareMismatches = compareSnapshots.filter((snapshot) => !compareSelectionKeys.has(toSelectionKey(snapshot.playerId, snapshot.side))).length;
  const invalidRoundLabels = snapshots.filter((snapshot) => snapshot.displayRoundNumber !== snapshot.roundNumber).length;
  const invalidJumpTargets = snapshots.filter((snapshot) => {
    const round = replay.rounds[snapshot.roundIndex];
    if (!round) {
      return true;
    }

    const startTick = resolveInitialRoundTick(round);
    const endTick = resolveVisibleRoundEndTick(round);
    return snapshot.targetTick < startTick || snapshot.targetTick > endTick;
  }).length;
  const maxWorldDrift = snapshots.reduce((maxDrift, snapshot) => {
    const round = replay.rounds[snapshot.roundIndex];
    const stream = round?.playerStreams.find((entry) => entry.playerId === snapshot.playerId);
    if (!stream) {
      return Number.POSITIVE_INFINITY;
    }

    const sample = interpolatePlayerStreamSample(stream, snapshot.targetTick);
    if (!sample || sample.x == null || sample.y == null) {
      return Number.POSITIVE_INFINITY;
    }

    return Math.max(maxDrift, Math.hypot(snapshot.x - sample.x, snapshot.y - sample.y));
  }, 0);

  console.log(
    [
      `offset=${offsetSeconds}s`,
      `all=${snapshots.length}`,
      `ct=${ctSnapshots.length}`,
      `t=${tSnapshots.length}`,
      `ctMismatches=${ctMismatches}`,
      `tMismatches=${tMismatches}`,
      `selectedCtMismatches=${selectedCtMismatches}`,
      `selectedTMismatches=${selectedTMismatches}`,
      `compareMismatches=${compareMismatches}`,
      `roundLabelMismatches=${invalidRoundLabels}`,
      `invalidJumpTargets=${invalidJumpTargets}`,
      `maxWorldDrift=${formatDrift(maxWorldDrift)}`,
      sideSwapPlayer
        ? `sideSwapPlayer=${sideSwapPlayer.displayName}:${sideSwapPlayer.sides.join("/")}`
        : "sideSwapPlayer=none",
    ].join(" | "),
  );
}

function collectPositionPlayerSnapshots(replayValue, selectedPlayers, teamFilter, comparisonOffsetTicks, showFreezeTime) {
  const snapshots = [];
  const selectedKeys = new Set(
    selectedPlayers.flatMap((selection) => selection.playerIds.map((playerId) => toSelectionKey(playerId, selection.side))),
  );

  for (const [roundIndex, round] of replayValue.rounds.entries()) {
    const displayStartTick = showFreezeTime ? round.startTick : resolveInitialRoundTick(round);
    const displayEndTick = resolveVisibleRoundEndTick(round);
    const targetTick = displayStartTick + comparisonOffsetTicks;
    if (targetTick < displayStartTick || targetTick > displayEndTick) {
      continue;
    }

    for (const stream of round.playerStreams) {
      const selectionKey = stream.side ? toSelectionKey(stream.playerId, stream.side) : null;
      if (selectedKeys.size > 0 && (!selectionKey || !selectedKeys.has(selectionKey))) {
        continue;
      }

      if (teamFilter !== "all" && stream.side !== teamFilter) {
        continue;
      }

      const player = playerById.get(stream.playerId);
      if (!player) {
        continue;
      }

      const sample = interpolatePlayerStreamSample(stream, targetTick);
      if (!sample || !sample.alive || sample.x == null || sample.y == null) {
        continue;
      }

      snapshots.push({
        displayRoundNumber: round.roundNumber,
        playerId: stream.playerId,
        playerName: player.displayName,
        roundIndex,
        roundNumber: round.roundNumber,
        side: stream.side,
        targetTick,
        x: sample.x,
        y: sample.y,
      });
    }
  }

  return snapshots;
}

function toSelectionKey(playerId, side) {
  return `${side}:${playerId}`;
}

function interpolatePlayerStreamSample(stream, currentTick) {
  const baseIndex = Math.floor(currentTick - stream.sampleOriginTick);
  if (baseIndex < 0 || baseIndex >= stream.x.length) {
    return null;
  }

  return {
    alive: stream.alive[baseIndex] ?? false,
    x: stream.x[baseIndex] ?? null,
    y: stream.y[baseIndex] ?? null,
  };
}

function resolveInitialRoundTick(round) {
  const liveStartTick = clampTick(round.freezeEndTick ?? round.startTick, round.startTick, round.endTick);
  const searchEndTick = Math.min(round.endTick, liveStartTick + 64 * 8);
  let firstVisibleTick = null;
  let firstBalancedTick = null;
  let bestTick = Math.max(
    liveStartTick,
    Math.min(...round.playerStreams.map((stream) => stream.sampleOriginTick)),
  );
  let bestVisibleCount = -1;

  for (let tick = liveStartTick; tick <= searchEndTick; tick += 1) {
    let ctVisibleCount = 0;
    let tVisibleCount = 0;

    for (const stream of round.playerStreams) {
      const index = tick - stream.sampleOriginTick;
      if (index < 0 || index >= stream.x.length || !stream.alive[index]) {
        continue;
      }

      if (stream.x[index] == null || stream.y[index] == null) {
        continue;
      }

      if (stream.side === "CT") {
        ctVisibleCount += 1;
      } else if (stream.side === "T") {
        tVisibleCount += 1;
      }
    }

    const visibleCount = ctVisibleCount + tVisibleCount;
    if (visibleCount > 0 && firstVisibleTick == null) {
      firstVisibleTick = tick;
    }
    if (visibleCount >= 8 && ctVisibleCount >= 3 && tVisibleCount >= 3 && firstBalancedTick == null) {
      firstBalancedTick = tick;
    }
    if (visibleCount > bestVisibleCount) {
      bestVisibleCount = visibleCount;
      bestTick = tick;
    }
    if (visibleCount >= 10 && ctVisibleCount >= 5 && tVisibleCount >= 5) {
      return tick;
    }
  }

  return firstBalancedTick ?? firstVisibleTick ?? bestTick;
}

function resolveVisibleRoundEndTick(round) {
  return round.officialEndTick != null && round.officialEndTick > round.endTick ? round.officialEndTick : round.endTick;
}

function clampTick(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function findPlayerWithBothSides(replayValue) {
  const sidesByPlayer = new Map();

  for (const round of replayValue.rounds) {
    for (const stream of round.playerStreams) {
      if (!stream.side) {
        continue;
      }

      const sides = sidesByPlayer.get(stream.playerId) ?? new Set();
      sides.add(stream.side);
      sidesByPlayer.set(stream.playerId, sides);
    }
  }

  const entry = [...sidesByPlayer.entries()].find(([, sides]) => sides.has("CT") && sides.has("T"));
  if (!entry) {
    return null;
  }

  const [playerId, sides] = entry;
  const player = playerById.get(playerId);
  return {
    displayName: player?.displayName ?? playerId,
    playerId,
    sides: [...sides].sort(),
  };
}

function resolveCompareSelections(replayValue) {
  const selections = [];
  const seen = new Set();

  for (const round of replayValue.rounds ?? []) {
    for (const stream of round.playerStreams ?? []) {
      if (!stream.side) {
        continue;
      }

      const key = toSelectionKey(stream.playerId, stream.side);
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      selections.push({ playerIds: [stream.playerId], side: stream.side });
      if (selections.length >= 2) {
        return selections;
      }
    }
  }

  return selections;
}

function formatDrift(value) {
  if (!Number.isFinite(value)) {
    return "invalid";
  }

  return value.toFixed(4);
}
