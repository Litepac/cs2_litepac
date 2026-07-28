import assert from "node:assert/strict";
import test from "node:test";

import {
  BOMB_FIELD_CUE_SECONDS,
  resolveBombFieldCueAlpha,
} from "../src/canvas/replayStage/bombDamageCuePresentation.ts";

test("holds the compiled bomb field before a slower fade", () => {
  assert.equal(resolveBombFieldCueAlpha(-0.01), 0);
  assert.ok(resolveBombFieldCueAlpha(0) >= 0.35);
  assert.ok(resolveBombFieldCueAlpha(0.12) >= 0.9);
  assert.ok(resolveBombFieldCueAlpha(1.4) >= 0.85);
  assert.ok(resolveBombFieldCueAlpha(2.5) > 0.35);
  assert.equal(resolveBombFieldCueAlpha(BOMB_FIELD_CUE_SECONDS), 0);
  assert.equal(resolveBombFieldCueAlpha(BOMB_FIELD_CUE_SECONDS + 0.01), 0);
});
