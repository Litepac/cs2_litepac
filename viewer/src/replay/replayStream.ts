export type DemoParseStage = "upload" | "parser" | "validate";

type ReadParseStreamOptions = {
  onArtifact?: (artifact: Blob) => void;
  onProgress?: (progress: { roundsParsed: number; roundsTotal?: number }) => void;
  onStage?: (stage: DemoParseStage) => void;
};

type StreamEvent =
  | { type: "progress"; roundsParsed?: number; roundsTotal?: number }
  | { type: "result" }
  | { type: "result"; replay: unknown }
  | { type: "error"; error?: string };

export async function readParseStream(response: Response, options?: ReadParseStreamOptions) {
  if (response.body == null) {
    return (await response.json()) as unknown;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json") && !contentType.includes("ndjson")) {
    return (await response.json()) as unknown;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let eventBytes: Uint8Array<ArrayBuffer> = new Uint8Array(0);
  let finalReplay: unknown = null;
  let readingReplay = false;
  const replayChunks: Uint8Array<ArrayBuffer>[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (value && value.byteLength > 0) {
      if (readingReplay) {
        replayChunks.push(copyBytes(value));
      } else {
        eventBytes = appendBytes(eventBytes, value);
        let newlineIndex = eventBytes.indexOf(10);
        while (newlineIndex >= 0) {
          const line = decoder.decode(eventBytes.subarray(0, newlineIndex)).trim();
          eventBytes = eventBytes.slice(newlineIndex + 1);
          if (line.length > 0) {
            const parsed = JSON.parse(line) as StreamEvent | Record<string, unknown>;
            if (isReplayStreamMarker(parsed)) {
              readingReplay = true;
              if (eventBytes.byteLength > 0) {
                replayChunks.push(eventBytes);
                eventBytes = new Uint8Array(0);
              }
              break;
            }
            finalReplay = consumeParsedStreamEvent(parsed, finalReplay, options);
          }
          newlineIndex = eventBytes.indexOf(10);
        }
      }
    }

    if (done) {
      break;
    }
  }

  if (readingReplay) {
    const replayArtifact = new Blob(replayChunks, { type: "application/json" });
    options?.onArtifact?.(replayArtifact);
    const replayText = await replayArtifact.text();
    finalReplay = JSON.parse(replayText) as unknown;
  } else if (eventBytes.byteLength > 0) {
    const trailing = decoder.decode(eventBytes).trim();
    if (trailing.length > 0) {
      finalReplay = consumeStreamLine(trailing, finalReplay, options);
    }
  }

  if (finalReplay == null) {
    throw new Error("Parser bridge did not return a replay artifact.");
  }

  emitReplayRoundProgress(finalReplay, options);
  return finalReplay;
}

function appendBytes(
  left: Uint8Array<ArrayBuffer>,
  right: Uint8Array<ArrayBufferLike>,
): Uint8Array<ArrayBuffer> {
  if (left.byteLength === 0) {
    return copyBytes(right);
  }
  const combined = new Uint8Array(left.byteLength + right.byteLength);
  combined.set(left);
  combined.set(right, left.byteLength);
  return combined;
}

function copyBytes(value: Uint8Array<ArrayBufferLike>): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy;
}

function isReplayStreamMarker(value: StreamEvent | Record<string, unknown>): value is { type: "result" } {
  return value.type === "result" && !("replay" in value);
}

function consumeStreamLine(line: string, currentReplay: unknown, options?: ReadParseStreamOptions) {
  const parsed = JSON.parse(line) as StreamEvent | Record<string, unknown>;
  return consumeParsedStreamEvent(parsed, currentReplay, options);
}

function consumeParsedStreamEvent(
  parsed: StreamEvent | Record<string, unknown>,
  currentReplay: unknown,
  options?: ReadParseStreamOptions,
) {
  if (isReplayPayload(parsed)) {
    return parsed;
  }

  const event = parsed as StreamEvent;
  if (event.type === "progress" && typeof event.roundsParsed === "number") {
    options?.onStage?.("parser");
    options?.onProgress?.({
      roundsParsed: event.roundsParsed,
      roundsTotal: typeof event.roundsTotal === "number" ? event.roundsTotal : undefined,
    });
    return currentReplay;
  }

  if (event.type === "result" && "replay" in event) {
    return event.replay;
  }

  if (event.type === "error") {
    throw new Error(sanitizeParserErrorMessage(event.error || "Demo parse failed."));
  }

  return currentReplay;
}

function emitReplayRoundProgress(replay: unknown, options?: Pick<ReadParseStreamOptions, "onProgress">) {
  if (replay == null || typeof replay !== "object") {
    return;
  }
  const rounds = (replay as { rounds?: unknown }).rounds;
  if (Array.isArray(rounds)) {
    options?.onProgress?.({ roundsParsed: rounds.length, roundsTotal: rounds.length });
  }
}

function isReplayPayload(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && "format" in value && "rounds" in value;
}

export function sanitizeParserErrorMessage(message: string) {
  const trimmed = message.trim();
  if (!trimmed) {
    return "Demo processing failed.";
  }

  const cleaned = stripGoStackTrace(trimmed);
  const normalized = cleaned.toLowerCase();
  if (
    normalized.includes("unable to find existing entity") ||
    (normalized.includes("entity data") && normalized.includes("cannot safely read"))
  ) {
    return "This demo uses entity data the current review parser cannot safely read yet.";
  }
  if (normalized.includes("parse demo crashed") || normalized.includes("crashed")) {
    return "The local review parser hit an unsupported demo state.";
  }
  return cleaned;
}

function stripGoStackTrace(message: string) {
  const lowerMessage = message.toLowerCase();
  const markers = [" stacktrace:", "\nstacktrace:", "\ngoroutine ", " goroutine "];
  let endIndex = -1;

  for (const marker of markers) {
    const index = lowerMessage.indexOf(marker);
    if (index >= 0 && (endIndex < 0 || index < endIndex)) {
      endIndex = index;
    }
  }

  return (endIndex >= 0 ? message.slice(0, endIndex) : message).trim();
}
