import assert from "node:assert/strict";
import test from "node:test";

import { interpolatePlayerStreamSample } from "../src/replay/playerStream.ts";

function createStream(overrides = {}) {
  const sampleCount = overrides.x?.length ?? 2;
  const repeated = (value) => Array.from({ length: sampleCount }, () => value);

  return {
    playerId: "player-1",
    side: "T",
    sampleOriginTick: 100,
    sampleIntervalTicks: 1,
    x: repeated(0),
    y: repeated(0),
    z: repeated(0),
    yaw: repeated(0),
    pitch: repeated(0),
    eyeX: repeated(0),
    eyeY: repeated(0),
    eyeZ: repeated(0),
    isScoped: repeated(false),
    zoomLevel: repeated(0),
    viewmodelFov: repeated(68),
    viewmodelOffsetX: repeated(0),
    viewmodelOffsetY: repeated(0),
    viewmodelOffsetZ: repeated(0),
    recoilIndex: repeated(0),
    isWalking: repeated(false),
    isDucking: repeated(false),
    isOnGround: repeated(true),
    alive: repeated(true),
    hasBomb: repeated(false),
    health: repeated(100),
    armor: repeated(0),
    hasHelmet: repeated(false),
    money: repeated(800),
    activeWeapon: repeated(null),
    activeWeaponClass: repeated(null),
    mainWeapon: repeated(null),
    flashbangs: repeated(0),
    smokes: repeated(0),
    heGrenades: repeated(0),
    fireGrenades: repeated(0),
    decoys: repeated(0),
    ...overrides,
  };
}

test("an exact sample tick preserves numeric and angle nulls", () => {
  const sample = interpolatePlayerStreamSample(
    createStream({
      x: [null, 20],
      yaw: [null, 90],
      isWalking: [null, true],
    }),
    100,
  );

  assert.ok(sample);
  assert.equal(sample.x, null);
  assert.equal(sample.yaw, null);
  assert.equal(sample.isWalking, null);
});

test("interpolation stays unknown when either numeric or angle endpoint is unknown", () => {
  const stream = createStream({
    x: [null, 20, null],
    y: [10, null, 30],
    yaw: [null, 90, null],
  });

  const firstInterval = interpolatePlayerStreamSample(stream, 100.5);
  assert.ok(firstInterval);
  assert.equal(firstInterval.x, null);
  assert.equal(firstInterval.y, null);
  assert.equal(firstInterval.yaw, null);

  const secondInterval = interpolatePlayerStreamSample(stream, 101.5);
  assert.ok(secondInterval);
  assert.equal(secondInterval.x, null);
  assert.equal(secondInterval.y, null);
  assert.equal(secondInterval.yaw, null);
});

test("known numeric and angle endpoints still interpolate", () => {
  const sample = interpolatePlayerStreamSample(
    createStream({
      x: [10, 20],
      yaw: [170, -170],
    }),
    100.5,
  );

  assert.ok(sample);
  assert.equal(sample.x, 15);
  assert.equal(sample.yaw, 180);
});
