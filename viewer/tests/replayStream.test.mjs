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
