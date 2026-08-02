import assert from "node:assert/strict";
import test from "node:test";

import { buildRecentFlashImpacts, FLASH_IMPACT_LINK_SECONDS } from "../src/replay/flashImpact.ts";

function roundWithBlindEvents(blindEvents) {
  return { blindEvents };
}

test("links only parser-bound flash victims", () => {
  const round = roundWithBlindEvents([
    { tick: 1_000, playerId: "player-a", utilityId: "utility-1", durationTicks: 256, endTick: 1_256 },
    { tick: 1_000, playerId: "player-b", durationTicks: 256, endTick: 1_256 },
  ]);

  assert.deepEqual(buildRecentFlashImpacts(round, 1_000, 64), [
    {
      fade: 1,
      playerId: "player-a",
      severity: 256 / (64 * 5.2),
      tick: 1_000,
      utilityId: "utility-1",
    },
  ]);
});

test("holds impact links for review before fading them out", () => {
  const round = roundWithBlindEvents([
    { tick: 1_000, playerId: "player-a", utilityId: "utility-1", durationTicks: 320, endTick: 1_320 },
  ]);
  const windowTicks = Math.round(64 * FLASH_IMPACT_LINK_SECONDS);

  assert.equal(buildRecentFlashImpacts(round, 1_000 + Math.floor(windowTicks * 0.5), 64)[0].fade, 1);
  assert.ok(buildRecentFlashImpacts(round, 1_000 + Math.floor(windowTicks * 0.8), 64)[0].fade < 0.5);
  assert.equal(buildRecentFlashImpacts(round, 1_000 + windowTicks + 1, 64).length, 0);
});

test("encodes actual blind duration as impact severity", () => {
  const round = roundWithBlindEvents([
    { tick: 1_000, playerId: "short", utilityId: "utility-1", durationTicks: 16, endTick: 1_016 },
    { tick: 1_000, playerId: "full", utilityId: "utility-1", durationTicks: 400, endTick: 1_400 },
  ]);
  const impacts = buildRecentFlashImpacts(round, 1_000, 64);

  assert.ok(impacts[0].severity < 0.1);
  assert.equal(impacts[1].severity, 1);
});
