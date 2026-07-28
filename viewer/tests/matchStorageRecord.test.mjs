import assert from "node:assert/strict";
import test from "node:test";

import { createStoredMatchRecord } from "../src/replay/matchStorageRecord.ts";

test("persists the raw artifact without cloning the replay graph", async () => {
  const replayArtifact = new Blob(['{"format":"mastermind.replay","rounds":[]}'], {
    type: "application/json",
  });
  const entry = {
    id: "demo:sha:added",
    addedAt: "2026-07-28T00:00:00.000Z",
    fingerprint: "demo:sha",
    mapId: "de_mirage",
    replay: { prohibitStructuredClone: Symbol("large replay graph") },
    source: "demo",
    summary: { mapName: "Mirage" },
  };

  const record = createStoredMatchRecord(entry, replayArtifact);
  const clonedRecord = structuredClone(record);

  assert.equal("replay" in record, false);
  assert.equal(await clonedRecord.replayArtifact.text(), await replayArtifact.text());
  assert.equal(clonedRecord.fingerprint, entry.fingerprint);
  assert.equal(clonedRecord.mapId, entry.mapId);
});
