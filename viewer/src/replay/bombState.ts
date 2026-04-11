import { interpolatePlayerStreamSample } from "./playerStream";
import type { Replay, Round } from "./types";

export type ActiveBombState = {
  defuseCompletionTick: number | null;
  defuseStartTick: number | null;
  explodeTick: number | null;
  plantedTick: number;
  x: number;
  y: number;
};

export type DroppedBombState = {
  droppedTick: number;
  x: number;
  y: number;
};

export function resolveActiveBombState(replay: Replay, round: Round, currentTick: number): ActiveBombState | null {
  const plantedEvents = round.bombEvents.filter((event) => event.type === "planted" && event.tick <= currentTick);
  const planted = plantedEvents[plantedEvents.length - 1];
  if (!planted || planted.x == null || planted.y == null) {
    return null;
  }

  const terminal = round.bombEvents.find(
    (event) => event.tick > planted.tick && ["defused", "exploded"].includes(event.type),
  );
  if (terminal && terminal.tick <= currentTick) {
    return null;
  }

  const bombFlowEvents = round.bombEvents.filter(
    (event) => event.tick > planted.tick && ["defuse_start", "defuse_abort", "defused"].includes(event.type),
  );

  let activeDefuseStart: Round["bombEvents"][number] | null = null;
  for (const event of bombFlowEvents) {
    if (event.tick > currentTick) {
      break;
    }

    if (event.type === "defuse_start") {
      activeDefuseStart = event;
      continue;
    }

    if (event.type === "defuse_abort" || event.type === "defused") {
      activeDefuseStart = null;
    }
  }

  let defuseCompletionTick: number | null = null;
  if (activeDefuseStart) {
    const nextBombFlow = bombFlowEvents.find((event) => event.tick > activeDefuseStart.tick);
    if (nextBombFlow?.type === "defused") {
      defuseCompletionTick = nextBombFlow.tick;
    }
  }

  const explodeEvent = round.bombEvents.find((event) => event.tick > planted.tick && event.type === "exploded");
  const explodeTick =
    replayBombExplodeTick(replay.match.tickRate, replay.match.bombTimeSeconds ?? null, planted.tick) ?? explodeEvent?.tick ?? null;

  return {
    defuseCompletionTick,
    defuseStartTick: activeDefuseStart?.tick ?? null,
    explodeTick,
    plantedTick: planted.tick,
    x: planted.x,
    y: planted.y,
  };
}

export function resolveDroppedBombState(round: Round, currentTick: number): DroppedBombState | null {
  const liveCarrier = round.playerStreams.some((stream) => {
    const sample = interpolatePlayerStreamSample(stream, currentTick);
    return sample?.alive && sample.hasBomb;
  });
  if (liveCarrier) {
    return null;
  }

  const droppedEvents = round.bombEvents.filter((event) => event.type === "drop" && event.tick <= currentTick);
  const dropped = droppedEvents[droppedEvents.length - 1];
  if (!dropped) {
    return null;
  }

  const clearingEvent = round.bombEvents.find(
    (event) =>
      event.tick > dropped.tick &&
      event.tick <= currentTick &&
      ["pickup", "plant_start", "planted", "defused", "exploded"].includes(event.type),
  );
  if (clearingEvent) {
    return null;
  }

  const sampledPosition = sampleDroppedBombPosition(round.droppedBombStream ?? null, currentTick);
  if (sampledPosition) {
    return {
      droppedTick: dropped.tick,
      x: sampledPosition.x,
      y: sampledPosition.y,
    };
  }

  if (dropped.x == null || dropped.y == null) {
    return null;
  }

  return {
    droppedTick: dropped.tick,
    x: dropped.x,
    y: dropped.y,
  };
}

function sampleDroppedBombPosition(
  stream: Round["droppedBombStream"] | null,
  currentTick: number,
): { x: number; y: number } | null {
  if (!stream) {
    return null;
  }

  const sampleIntervalTicks = Math.max(1, stream.sampleIntervalTicks || 1);
  const relativeTick = currentTick - stream.sampleOriginTick;
  if (relativeTick < 0) {
    return null;
  }

  const sampleIndex = Math.floor(relativeTick / sampleIntervalTicks);
  if (sampleIndex < 0 || sampleIndex >= stream.x.length) {
    return null;
  }

  const x = stream.x[sampleIndex];
  const y = stream.y[sampleIndex];
  if (x == null || y == null) {
    return null;
  }

  return { x, y };
}

function replayBombExplodeTick(tickRate: number, bombTimeSeconds: number | null, plantedTick: number) {
  if (bombTimeSeconds == null || !Number.isFinite(bombTimeSeconds) || bombTimeSeconds <= 0 || tickRate <= 0) {
    return null;
  }

  return plantedTick + Math.round(bombTimeSeconds * tickRate);
}
