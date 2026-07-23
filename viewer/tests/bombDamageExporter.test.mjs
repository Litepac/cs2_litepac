import assert from "node:assert/strict";
import test from "node:test";

import {
  encodeRgbaPng,
  parseBombDamageResource,
  renderSiteMask,
} from "../../tools/export-bomb-damage-field.mjs";

test("parses site-major propagation costs and renders only in-range samples", () => {
  const bombsites = Buffer.alloc(56);
  writeSite(bombsites, 0, [0, 0, -10, 20, 20, 10, 15]);
  writeSite(bombsites, 28, [80, 80, -10, 100, 100, 10, 35]);

  const positions = Buffer.alloc(12);
  writePosition(positions, 0, [0, 0, 0]);
  writePosition(positions, 6, [90, 90, 0]);

  const damageValues = Buffer.alloc(16);
  damageValues.writeUInt16LE(10, 0);
  damageValues.writeUInt16LE(20, 4);
  damageValues.writeUInt16LE(30, 8);
  damageValues.writeUInt16LE(40, 12);

  const resource = parseBombDamageResource(`
    generic_data_type = "CS2_BOMB_DAMAGE_DATA"
    bombsites = #[ ${toHex(bombsites)} ]
    positions = #[ ${toHex(positions)} ]
    damage_values = #[ ${toHex(damageValues)} ]
  `);

  assert.deepEqual(Array.from(resource.propagationCosts[0]), [10, 20]);
  assert.deepEqual(Array.from(resource.propagationCosts[1]), [30, 40]);
  assert.equal(resource.sites[0].propagationRange, 15);
  assert.equal(resource.sites[1].propagationRange, 35);

  const mask = renderSiteMask(
    resource,
    0,
    { worldXMin: 0, worldXMax: 100, worldYMin: 0, worldYMax: 100 },
    100,
    100,
  );
  assert.ok(alphaAt(mask, 100, 0, 99) > 0);
  assert.equal(alphaAt(mask, 100, 89, 10), 0);

  const png = encodeRgbaPng(100, 100, mask);
  assert.deepEqual(Array.from(png.subarray(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10]);
});

function writeSite(buffer, offset, values) {
  values.forEach((value, index) => buffer.writeFloatLE(value, offset + index * 4));
}

function writePosition(buffer, offset, values) {
  values.forEach((value, index) => buffer.writeInt16LE(value, offset + index * 2));
}

function toHex(buffer) {
  return Array.from(buffer, (value) => value.toString(16).padStart(2, "0")).join(" ");
}

function alphaAt(buffer, width, x, y) {
  return buffer[(y * width + x) * 4 + 3];
}
