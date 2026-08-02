import { Container, Graphics } from "pixi.js";

import type { RadarViewport } from "../../mapGeometry/transform";
import { worldToScreen } from "../../mapGeometry/transform";
import {
  buildRecentFlashImpacts,
  resolveFlashImpactEnvelopePresentation,
} from "../../replay/flashImpact";
import { interpolatePlayerStreamSample } from "../../replay/playerStream";
import type { Replay, Round } from "../../replay/types";

type Point = { x: number; y: number };

type FlashImpactEnvelope = {
  ageSeconds: number;
  fade: number;
  farthestVictimDistance: number;
  origin: Point;
};

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
  const envelopesByUtilityId = new Map<string, FlashImpactEnvelope>();
  const envelopes = new Graphics();
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
    const victimDistance = Math.hypot(target.x - origin.x, target.y - origin.y);
    const envelope = envelopesByUtilityId.get(impact.utilityId);
    if (envelope) {
      envelope.farthestVictimDistance = Math.max(envelope.farthestVictimDistance, victimDistance);
      envelope.fade = Math.max(envelope.fade, impact.fade);
    } else {
      envelopesByUtilityId.set(impact.utilityId, {
        ageSeconds: impact.ageSeconds,
        fade: impact.fade,
        farthestVictimDistance: victimDistance,
        origin,
      });
    }

    if (drawFlashImpactConnection(links, origin, target, impact.severity, impact.fade)) {
      linkCount += 1;
    }
  }

  for (const envelope of envelopesByUtilityId.values()) {
    drawFlashImpactEnvelope(envelopes, envelope);
  }

  if (envelopesByUtilityId.size > 0) {
    layer.addChild(envelopes);
  } else {
    envelopes.destroy();
  }

  if (linkCount > 0) {
    layer.addChild(links);
  } else {
    links.destroy();
  }
}

function drawFlashImpactEnvelope(graphics: Graphics, envelope: FlashImpactEnvelope) {
  const presentation = resolveFlashImpactEnvelopePresentation(
    envelope.farthestVictimDistance,
    envelope.ageSeconds,
    envelope.fade,
  );

  graphics.circle(envelope.origin.x, envelope.origin.y, presentation.radius);
  graphics.stroke({
    color: 0xffe9a8,
    width: 10,
    alpha: 0.035 * presentation.fade,
  });
  drawDashedFlashEnvelope(graphics, envelope.origin, presentation.radius);
  graphics.stroke({
    color: 0xffe39a,
    width: 1.5,
    alpha: 0.34 * presentation.fade,
    cap: "round",
  });
}

function drawDashedFlashEnvelope(graphics: Graphics, origin: Point, radius: number) {
  const segmentCount = Math.max(28, Math.round(radius / 3.5));
  for (let index = 0; index < segmentCount; index += 2) {
    const startAngle = (index / segmentCount) * Math.PI * 2;
    const endAngle = (Math.min(index + 1.2, segmentCount) / segmentCount) * Math.PI * 2;
    graphics.moveTo(origin.x + Math.cos(startAngle) * radius, origin.y + Math.sin(startAngle) * radius);
    graphics.lineTo(origin.x + Math.cos(endAngle) * radius, origin.y + Math.sin(endAngle) * radius);
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
