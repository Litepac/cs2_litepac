import { Container, Graphics } from "pixi.js";

import type { RadarViewport } from "../../mapGeometry/transform";
import { worldToScreen } from "../../mapGeometry/transform";
import { buildRecentFlashImpacts } from "../../replay/flashImpact";
import { interpolatePlayerStreamSample } from "../../replay/playerStream";
import type { Replay, Round } from "../../replay/types";

type Point = { x: number; y: number };

export function drawRecentFlashImpactLinks(
  layer: Container,
  replay: Replay,
  round: Round,
  currentTick: number,
  radarViewport: RadarViewport,
) {
  const impacts = buildRecentFlashImpacts(round, currentTick, replay.match.tickRate);
  if (impacts.length === 0) {
    return;
  }

  const utilityById = new Map(round.utilityEntities.map((utility) => [utility.utilityId, utility]));
  const streamByPlayerId = new Map(round.playerStreams.map((stream) => [stream.playerId, stream]));
  const links = new Graphics();
  let linkCount = 0;

  for (const impact of impacts) {
    const utility = utilityById.get(impact.utilityId);
    const stream = streamByPlayerId.get(impact.playerId);
    if (!utility || utility.kind !== "flashbang" || !stream) {
      continue;
    }

    const detonation = utility.phaseEvents.find(
      (event) =>
        event.type === "detonate" &&
        event.tick === impact.tick &&
        event.x != null &&
        event.y != null,
    );
    const playerSample = interpolatePlayerStreamSample(stream, currentTick);
    if (!detonation || detonation.x == null || detonation.y == null || !playerSample?.alive) {
      continue;
    }
    if (playerSample.x == null || playerSample.y == null) {
      continue;
    }

    const origin = worldToScreen(replay, radarViewport, detonation.x, detonation.y);
    const target = worldToScreen(replay, radarViewport, playerSample.x, playerSample.y);
    if (drawFlashImpactConnection(links, origin, target, impact.severity, impact.fade)) {
      linkCount += 1;
    }
  }

  if (linkCount > 0) {
    layer.addChild(links);
  } else {
    links.destroy();
  }
}

function drawFlashImpactConnection(
  graphics: Graphics,
  origin: Point,
  target: Point,
  severity: number,
  fade: number,
) {
  const deltaX = target.x - origin.x;
  const deltaY = target.y - origin.y;
  const distance = Math.hypot(deltaX, deltaY);
  if (distance < 30 || fade <= 0) {
    return false;
  }

  const directionX = deltaX / distance;
  const directionY = deltaY / distance;
  const start = {
    x: origin.x + directionX * 18,
    y: origin.y + directionY * 18,
  };
  const end = {
    x: target.x - directionX * 13,
    y: target.y - directionY * 13,
  };

  graphics.moveTo(start.x, start.y);
  graphics.lineTo(end.x, end.y);
  graphics.stroke({
    color: 0xfff1bd,
    width: 3.8 + severity * 2.2,
    alpha: (0.018 + severity * 0.035) * fade,
    cap: "round",
  });

  drawDashedFlashLink(graphics, start, end);
  graphics.stroke({
    color: 0xffedaa,
    width: 1.05 + severity * 0.55,
    alpha: (0.12 + severity * 0.3) * fade,
    cap: "round",
  });

  graphics.circle(target.x, target.y, 11 + severity * 3.2);
  graphics.stroke({
    color: 0xfff7db,
    width: 0.8 + severity * 0.5,
    alpha: (0.08 + severity * 0.24) * fade,
  });
  return true;
}

function drawDashedFlashLink(graphics: Graphics, start: Point, end: Point) {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const distance = Math.hypot(deltaX, deltaY);
  if (distance <= 0) {
    return;
  }

  const dashLength = 6;
  const step = 11;
  for (let offset = 0; offset < distance; offset += step) {
    const dashEnd = Math.min(distance, offset + dashLength);
    graphics.moveTo(start.x + (deltaX * offset) / distance, start.y + (deltaY * offset) / distance);
    graphics.lineTo(start.x + (deltaX * dashEnd) / distance, start.y + (deltaY * dashEnd) / distance);
  }
}
