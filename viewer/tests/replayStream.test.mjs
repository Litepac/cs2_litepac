import assert from "node:assert/strict";
import test from "node:test";

import { readParseStream } from "../src/replay/replayStream.ts";

function fragmentedResponse(fragments) {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      for (const fragment of fragments) {
        controller.enqueue(encoder.encode(fragment));
      }
      controller.close();
    },
  });

  return new Response(body, {
    headers: { "Content-Type": "application/x-ndjson" },
  });
}

test("reads a raw replay artifact after a fragmented stream marker", async () => {
  const progress = [];
  let replayArtifact = null;
  const response = fragmentedResponse([
    '{"type":"progress","roundsParsed":1,"roundsTotal":2',
    '}\n{"type":"result"}\n{"format":"mastermind.re',
    'play","rounds":[{"number":1},{"number":2}]}',
  ]);

  const replay = await readParseStream(response, {
    onArtifact(artifact) {
      replayArtifact = artifact;
    },
    onProgress(value) {
      progress.push(value);
    },
  });

  assert.deepEqual(replay, {
    format: "mastermind.replay",
    rounds: [{ number: 1 }, { number: 2 }],
  });
  assert.deepEqual(progress, [
    { roundsParsed: 1, roundsTotal: 2 },
    { roundsParsed: 2, roundsTotal: 2 },
  ]);
  assert.equal(
    await replayArtifact.text(),
    '{"format":"mastermind.replay","rounds":[{"number":1},{"number":2}]}',
  );
});

test("keeps compatibility with the legacy wrapped result event", async () => {
  const replay = { format: "mastermind.replay", rounds: [{ number: 1 }] };
  const response = fragmentedResponse([
    `${JSON.stringify({ type: "result", replay })}\n`,
  ]);

  assert.deepEqual(await readParseStream(response), replay);
});

test("keeps a multi-megabyte replay artifact chunked until the final parse", async () => {
  const payload = "x".repeat(4 * 1024 * 1024);
  const replayText = JSON.stringify({ format: "mastermind.replay", notes: payload, rounds: [] });
  const fragments = ['{"type":"result"}\n'];
  for (let offset = 0; offset < replayText.length; offset += 64 * 1024) {
    fragments.push(replayText.slice(offset, offset + 64 * 1024));
  }

  let replayArtifact = null;
  const replay = await readParseStream(fragmentedResponse(fragments), {
    onArtifact(artifact) {
      replayArtifact = artifact;
    },
  });

  assert.equal(replay.notes.length, payload.length);
  assert.equal(replayArtifact.size, new TextEncoder().encode(replayText).byteLength);
});
