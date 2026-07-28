import assert from "node:assert/strict";
import test from "node:test";

import { resolveUtilityBurstPresentation } from "../src/canvas/utilityBurstPresentation.ts";
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

test("detonation cues remain compact and fade without claiming a blast radius", () => {
  const flashStart = resolveUtilityBurstPresentation("flashbang", 0);
  const flashEnd = resolveUtilityBurstPresentation("flashbang", 1);
  const heStart = resolveUtilityBurstPresentation("hegrenade", 0);
  const heEnd = resolveUtilityBurstPresentation("hegrenade", 1);

  assert.ok(flashStart.outerRadius < flashEnd.outerRadius);
  assert.ok(flashEnd.outerRadius <= 34);
  assert.ok(heStart.outerRadius < heEnd.outerRadius);
  assert.ok(heEnd.outerRadius <= 23);
  assert.equal(flashEnd.fade, 0);
  assert.equal(heEnd.fade, 0);
});
