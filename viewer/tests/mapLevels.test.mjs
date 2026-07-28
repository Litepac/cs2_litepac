import assert from "node:assert/strict";
import test from "node:test";

import { AUTO_MAP_LEVEL, resolveMapLevel } from "../src/replay/mapLevels.ts";

const nuke = {
  mapId: "de_nuke",
  displayName: "Nuke",
  radarImageKey: "de_nuke/radar.png",
  verticalSections: [
    {
      sectionId: "upper",
      displayName: "Upper",
      radarImageKey: "de_nuke/radar.png",
      altitudeMin: -495,
      altitudeMax: 10000,
    },
    {
      sectionId: "lower",
      displayName: "Lower",
      radarImageKey: "de_nuke/radar-lower.png",
      altitudeMin: -10000,
      altitudeMax: -495,
    },
  ],
  coordinateSystem: {},
};

test("automatic Nuke floor follows the official altitude boundary", () => {
  assert.equal(resolveMapLevel(nuke, -494, AUTO_MAP_LEVEL).section?.sectionId, "upper");
  assert.equal(resolveMapLevel(nuke, -495, AUTO_MAP_LEVEL).section?.sectionId, "upper");
  assert.equal(resolveMapLevel(nuke, -496, AUTO_MAP_LEVEL).section?.sectionId, "lower");
});

test("manual floor selection overrides player altitude", () => {
  const result = resolveMapLevel(nuke, 200, "lower");
  assert.equal(result.section?.sectionId, "lower");
  assert.equal(result.radarImageKey, "de_nuke/radar-lower.png");
});

test("single-layer maps retain their primary radar", () => {
  const result = resolveMapLevel({ ...nuke, verticalSections: undefined }, -1000, AUTO_MAP_LEVEL);
  assert.equal(result.section, null);
  assert.equal(result.radarImageKey, "de_nuke/radar.png");
});
