import assert from "node:assert/strict";
import test from "node:test";

import {
  getSmokeField,
  resolveSmokeLifecyclePresentation,
  SMOKE_FIELD_PALETTE,
} from "../src/canvas/smokePresentation.ts";

test("keeps the symbolic smoke field stable and bounded", () => {
  const first = getSmokeField("smoke-round-14-3");
  const repeated = getSmokeField("smoke-round-14-3");
  const other = getSmokeField("smoke-round-14-4");

  assert.equal(first, repeated);
  assert.equal(first.body.length, 9);
  assert.equal(first.veil.length, 4);
  assert.notDeepEqual(first.body, other.body);

  for (const lobe of [...first.body, ...first.veil]) {
    assert.ok(Number.isFinite(lobe.dx));
    assert.ok(Number.isFinite(lobe.dy));
    assert.ok(lobe.width >= 16 && lobe.width <= 24);
    assert.ok(lobe.height >= 16 && lobe.height <= 26);
    assert.ok(lobe.alpha > 0 && lobe.alpha <= 0.34);
  }
});

test("keeps the smoke body readable without a white core", () => {
  const field = getSmokeField("smoke-contrast-proof");
  const red = (SMOKE_FIELD_PALETTE.body >> 16) & 0xff;
  const green = (SMOKE_FIELD_PALETTE.body >> 8) & 0xff;
  const blue = SMOKE_FIELD_PALETTE.body & 0xff;

  assert.ok(red >= 0x80 && green >= 0x80 && blue >= 0x80);
  assert.ok(red < 0xd0 && green < 0xd0 && blue < 0xd0);
  assert.ok(field.body[0].alpha >= 0.32);
  assert.ok(field.body.slice(1).every((lobe) => lobe.alpha >= 0.22));
});

test("blooms and fades from parser-owned lifecycle timing", () => {
  const atDetonation = resolveSmokeLifecyclePresentation(0, 20);
  const active = resolveSmokeLifecyclePresentation(1, 19);
  const ending = resolveSmokeLifecyclePresentation(19.7, 0.3);
  const ended = resolveSmokeLifecyclePresentation(20, 0);

  assert.equal(atDetonation.opacity, 0.2);
  assert.ok(atDetonation.scale < active.scale);
  assert.equal(active.opacity, 1);
  assert.ok(ending.opacity < active.opacity);
  assert.equal(ended.opacity, 0);
});
