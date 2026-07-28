import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveSmokeLifecyclePresentation,
  resolveSmokeLifetimeProgress,
  SMOKE_FIELD_SIZE,
  SMOKE_LIFETIME_RING,
} from "../src/canvas/smokePresentation.ts";
import {
  applySmokeRasterCutout,
  createSmokeRasterPixels,
  SMOKE_RASTER_SIZE,
  SMOKE_RASTER_VARIANTS,
  smokeRasterVariant,
} from "../src/canvas/smokeRaster.ts";

test("creates a stable continuous smoke raster instead of overlapping primitives", () => {
  const first = createSmokeRasterPixels(3);
  const repeated = createSmokeRasterPixels(3);
  const other = createSmokeRasterPixels(4);

  assert.deepEqual(first, repeated);
  assert.notDeepEqual(first, other);
  assert.equal(first.length, SMOKE_RASTER_SIZE * SMOKE_RASTER_SIZE * 4);

  let visiblePixels = 0;
  let softEdgePixels = 0;
  let brightestChannel = 0;
  for (let offset = 0; offset < first.length; offset += 4) {
    const alpha = first[offset + 3];
    if (alpha > 8) {
      visiblePixels += 1;
      brightestChannel = Math.max(brightestChannel, first[offset], first[offset + 1], first[offset + 2]);
    }
    if (alpha > 8 && alpha < 180) {
      softEdgePixels += 1;
    }
  }

  const pixelCount = SMOKE_RASTER_SIZE * SMOKE_RASTER_SIZE;
  assert.ok(visiblePixels > pixelCount * 0.28);
  assert.ok(visiblePixels < pixelCount * 0.7);
  assert.ok(softEdgePixels > pixelCount * 0.04);
  assert.ok(brightestChannel < 225);
  assert.equal(first[3], 0);
});

test("keeps raster variants bounded and stable per utility", () => {
  const first = smokeRasterVariant("smoke-round-14-3");
  const repeated = smokeRasterVariant("smoke-round-14-3");
  const variants = new Set(Array.from({ length: 40 }, (_, index) => smokeRasterVariant(`smoke-${index}`)));

  assert.equal(first, repeated);
  assert.ok(first >= 0 && first < SMOKE_RASTER_VARIANTS);
  assert.ok(variants.size > 4);
});

test("opens a partial parser-backed displacement pocket in the raster", () => {
  const base = createSmokeRasterPixels(2);
  const displaced = applySmokeRasterCutout(base, {
    x: 0,
    y: 0,
    radiusX: 0.45,
    radiusY: 0.45,
    strength: 1,
  });
  const centerOffset = ((SMOKE_RASTER_SIZE / 2) * SMOKE_RASTER_SIZE + SMOKE_RASTER_SIZE / 2) * 4 + 3;

  assert.ok(base[centerOffset] > 180);
  assert.ok(displaced[centerOffset] < base[centerOffset] * 0.2);
  assert.equal(displaced[3], base[3]);
});

test("keeps smoke visible while making the lifecycle arc secondary", () => {
  assert.ok(SMOKE_FIELD_SIZE.width > SMOKE_LIFETIME_RING.radius * 4);
  assert.ok(SMOKE_FIELD_SIZE.height > SMOKE_LIFETIME_RING.radius * 3.5);
  assert.ok(SMOKE_LIFETIME_RING.width >= 4 && SMOKE_LIFETIME_RING.width < 5);
  assert.ok(SMOKE_LIFETIME_RING.backdropWidth > SMOKE_LIFETIME_RING.width);
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

test("derives the smoke arc from its parser-owned active window", () => {
  assert.equal(resolveSmokeLifetimeProgress(null, 20), null);
  assert.equal(resolveSmokeLifetimeProgress(20, 20), 1);
  assert.equal(resolveSmokeLifetimeProgress(10, 20), 0.5);
  assert.equal(resolveSmokeLifetimeProgress(0, 20), 0);
  assert.equal(resolveSmokeLifetimeProgress(22, 20), 1);
  assert.equal(resolveSmokeLifetimeProgress(10, 0), null);
});
