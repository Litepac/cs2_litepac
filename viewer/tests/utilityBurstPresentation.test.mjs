import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveResponsiveFlashBurstRadius,
  resolveUtilityBurstPresentation,
} from "../src/canvas/utilityBurstPresentation.ts";
import { utilityBurstProgress, utilitySceneStateAtTick } from "../src/replay/utility.ts";

function burstUtility(kind, detonateTick = 1_000) {
  return {
    detonateTick,
    endTick: detonateTick,
    fireFootprint: [],
    kind,
    phaseEvents: [],
    startTick: detonateTick - 80,
    throwerPlayerId: null,
    trajectory: { sampleIntervalTicks: 1, sampleOriginTick: detonateTick - 80, x: [], y: [], z: [] },
    utilityId: `${kind}-test`,
  };
}

test("flash and HE burst timing stays stable across tick rates", () => {
  const flash = burstUtility("flashbang");
  const he = burstUtility("hegrenade");

  assert.equal(utilityBurstProgress(flash, 1_008, 64), 0.5);
  assert.equal(utilityBurstProgress(flash, 1_016, 128), 0.5);
  assert.equal(utilityBurstProgress(he, 1_003, 64), 0.5);
  assert.ok(Math.abs(utilityBurstProgress(he, 1_006, 128) - 0.46) < 0.01);
});

test("burst cues end outside their bounded presentation window", () => {
  assert.equal(utilityBurstProgress(burstUtility("flashbang"), 1_017, 64), null);
  assert.equal(utilityBurstProgress(burstUtility("hegrenade"), 1_007, 64), null);
});

test("the detonation tick begins the burst instead of leaving a projectile marker", () => {
  const state = utilitySceneStateAtTick(burstUtility("flashbang"), 1_000, 64);

  assert.equal(state?.phase, "burst");
  assert.equal(state?.burstProgress, 0);
});

test("flash stays prominent while HE remains compact and both cues fade", () => {
  const flashStart = resolveUtilityBurstPresentation("flashbang", 0);
  const flashMid = resolveUtilityBurstPresentation("flashbang", 0.5);
  const flashEnd = resolveUtilityBurstPresentation("flashbang", 1);
  const heStart = resolveUtilityBurstPresentation("hegrenade", 0);
  const heEnd = resolveUtilityBurstPresentation("hegrenade", 1);

  assert.ok(flashStart.outerRadius < flashEnd.outerRadius);
  assert.ok(flashStart.outerRadius >= 50);
  assert.ok(flashMid.outerRadius >= 96);
  assert.ok(flashMid.glowRadius >= 70);
  assert.ok(flashMid.shockRadius >= 100);
  assert.ok(flashMid.fade > 0.85);
  assert.ok(flashEnd.outerRadius >= 102 && flashEnd.outerRadius <= 106);
  assert.ok(flashEnd.shockRadius >= 110 && flashEnd.shockRadius <= 114);
  assert.ok(flashEnd.outerRadius > heEnd.outerRadius * 4);
  assert.ok(heStart.outerRadius < heEnd.outerRadius);
  assert.ok(heEnd.outerRadius <= 23);
  assert.equal(flashEnd.fade, 0);
  assert.equal(heEnd.fade, 0);
});

test("flash pop expands quickly and holds through the readable middle", () => {
  const opening = resolveUtilityBurstPresentation("flashbang", 0.15);
  const middle = resolveUtilityBurstPresentation("flashbang", 0.6);
  const late = resolveUtilityBurstPresentation("flashbang", 0.85);

  assert.ok(opening.shockRadius >= 60);
  assert.ok(opening.fade > 0.99);
  assert.ok(middle.shockRadius >= 106);
  assert.ok(middle.fade > 0.7);
  assert.ok(late.fade < 0.2);
});

test("flash pop scales with the radar while staying bounded", () => {
  assert.equal(resolveResponsiveFlashBurstRadius(948, 644), 257.6);
  assert.equal(resolveResponsiveFlashBurstRadius(360, 640), 220);
  assert.equal(resolveResponsiveFlashBurstRadius(2_560, 1_440), 320);

  const presentation = resolveUtilityBurstPresentation("flashbang", 1, 257.6);
  assert.equal(presentation.shockRadius, 257.6);
  assert.ok(presentation.outerRadius > 239 && presentation.outerRadius < 240);
});
