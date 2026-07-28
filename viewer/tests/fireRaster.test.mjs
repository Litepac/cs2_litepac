import assert from "node:assert/strict";
import test from "node:test";

import {
  createFireRasterPixels,
  FIRE_FIELD_RADIUS,
  resolveFireRasterGeometry,
} from "../src/canvas/fireRaster.ts";

function alphaAt(geometry, pixels, screenX, screenY) {
  const x = Math.floor(screenX - geometry.originX);
  const y = Math.floor(screenY - geometry.originY);
  return pixels[(y * geometry.width + x) * 4 + 3];
}

test("fire raster joins nearby exact samples into one field", () => {
  const geometry = resolveFireRasterGeometry([{ x: 10, y: 12 }, { x: 30, y: 12 }]);
  assert.ok(geometry);
  const pixels = createFireRasterPixels(geometry);

  assert.ok(alphaAt(geometry, pixels, 20, 12) > 100);
});

test("fire raster does not bridge genuinely separate samples", () => {
  const geometry = resolveFireRasterGeometry([{ x: 10, y: 12 }, { x: 50, y: 12 }]);
  assert.ok(geometry);
  const pixels = createFireRasterPixels(geometry);

  assert.ok(alphaAt(geometry, pixels, 30, 12) < 10);
});

test("fire raster keeps the parser footprint bounds and avoids white cell cores", () => {
  const points = [{ x: 18, y: 22 }, { x: 36, y: 35 }, { x: 52, y: 24 }];
  const geometry = resolveFireRasterGeometry(points);
  assert.ok(geometry);
  const pixels = createFireRasterPixels(geometry);
  const visible = [];

  for (let offset = 0; offset < pixels.length; offset += 4) {
    if (pixels[offset + 3] > 0) {
      visible.push([pixels[offset], pixels[offset + 1], pixels[offset + 2], pixels[offset + 3]]);
    }
  }

  assert.ok(geometry.originX <= 18 - FIRE_FIELD_RADIUS);
  assert.ok(geometry.originY <= 22 - FIRE_FIELD_RADIUS);
  assert.ok(geometry.originX + geometry.width >= 52 + FIRE_FIELD_RADIUS);
  assert.ok(visible.length > 0);
  assert.ok(Math.max(...visible.map((pixel) => pixel[1])) <= 178);
  assert.ok(Math.max(...visible.map((pixel) => pixel[2])) <= 72);
});

test("fire raster is stable when parser samples arrive in another order", () => {
  const forward = resolveFireRasterGeometry([{ x: 10.1, y: 12.1 }, { x: 29.9, y: 12.2 }]);
  const reverse = resolveFireRasterGeometry([{ x: 29.9, y: 12.2 }, { x: 10.1, y: 12.1 }]);
  assert.ok(forward);
  assert.ok(reverse);

  assert.equal(forward.key, reverse.key);
  assert.deepEqual(createFireRasterPixels(forward), createFireRasterPixels(reverse));
});

test("fire raster rejects a pathological allocation", () => {
  assert.equal(resolveFireRasterGeometry([{ x: 0, y: 0 }, { x: 10_000, y: 10_000 }]), null);
});
