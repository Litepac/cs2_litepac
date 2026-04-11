import { validateReplay } from "./schema";
import type { Replay } from "./types";

export type DemoParseStage = "upload" | "parser" | "validate";
type StreamEvent =
  | { type: "progress"; roundsParsed?: number }
  | { type: "result"; replay: unknown }
  | { type: "error"; error?: string };

const parserApiBaseUrl =
  (import.meta.env.VITE_PARSER_API_BASE_URL as string | undefined)?.trim() || "";
const demoParseTimeoutMs = 5 * 60 * 1000;

type FeedbackContext = Record<string, unknown>;

function parserApiUrl(path: string) {
  return `${parserApiBaseUrl.replace(/\/+$/, "")}${path}`;
}

export async function checkParserBridge(): Promise<boolean> {
  try {
    const response = await fetch(`${parserApiUrl("/api/health")}?ts=${Date.now()}`, {
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}

const usageEventOnceKeys = new Set<string>();

export function trackUsageEvent(event: string, details?: Record<string, unknown>) {
  const trimmedEvent = event.trim();
  if (!trimmedEvent) {
    return;
  }

  void fetch(parserApiUrl("/api/usage-events"), {
    body: JSON.stringify({
      details: {
        host: window.location.host,
        path: window.location.pathname,
        ...(details ?? {}),
      },
      event: trimmedEvent,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    keepalive: true,
    method: "POST",
  }).catch(() => {
    // Usage logging must never block core app flows.
  });
}

export function trackUsageEventOnce(event: string, onceKey: string, details?: Record<string, unknown>) {
  const normalizedKey = `${event.trim()}::${onceKey.trim()}`;
  if (!event.trim() || !onceKey.trim() || usageEventOnceKeys.has(normalizedKey)) {
    return;
  }

  usageEventOnceKeys.add(normalizedKey);
  trackUsageEvent(event, details);
}

export async function submitFeedback(message: string, context?: FeedbackContext) {
  const response = await fetch(parserApiUrl("/api/feedback"), {
    body: JSON.stringify({
      context: {
        host: window.location.host,
        path: window.location.pathname,
        ...(context ?? {}),
      },
      message,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await parseParserError(response));
  }
}

export async function parseDemoFile(
  file: File,
  options?: { onProgress?: (progress: { roundsParsed: number }) => void; onStage?: (stage: DemoParseStage) => void },
): Promise<Replay> {
  const form = new FormData();
  form.append("demo", file, file.name);
  const abortController = new AbortController();
  const timeoutId = window.setTimeout(() => {
    abortController.abort();
  }, demoParseTimeoutMs);

  try {
    options?.onStage?.("upload");
    const responsePromise = fetch(parserApiUrl("/api/parse-demo"), {
      body: form,
      method: "POST",
      signal: abortController.signal,
    });
    options?.onStage?.("parser");
    const response = await responsePromise;

    if (!response.ok) {
      throw new Error(await parseParserError(response));
    }

    const parsed = await readParseStream(response, options);
    options?.onStage?.("validate");
    const result = validateReplay(parsed);
    if (!result.ok) {
      throw new Error(formatReplayErrors(result.errors));
    }

    return result.replay;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`Demo parsing timed out after ${Math.round(demoParseTimeoutMs / 60000)} minutes.`);
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function readParseStream(
  response: Response,
  options?: { onProgress?: (progress: { roundsParsed: number }) => void; onStage?: (stage: DemoParseStage) => void },
) {
  if (response.body == null) {
    return (await response.json()) as unknown;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json") && !contentType.includes("ndjson")) {
    return (await response.json()) as unknown;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalReplay: unknown = null;

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });

    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (line.length > 0) {
        finalReplay = consumeStreamLine(line, finalReplay, options);
      }
      newlineIndex = buffer.indexOf("\n");
    }

    if (done) {
      break;
    }
  }

  const trailing = buffer.trim();
  if (trailing.length > 0) {
    finalReplay = consumeStreamLine(trailing, finalReplay, options);
  }

  if (finalReplay == null) {
    throw new Error("Parser bridge did not return a replay artifact.");
  }

  return finalReplay;
}

function consumeStreamLine(
  line: string,
  currentReplay: unknown,
  options?: { onProgress?: (progress: { roundsParsed: number }) => void; onStage?: (stage: DemoParseStage) => void },
) {
  const parsed = JSON.parse(line) as StreamEvent | Record<string, unknown>;

  if (isReplayPayload(parsed)) {
    return parsed;
  }

  const event = parsed as StreamEvent;
  if (event.type === "progress" && typeof event.roundsParsed === "number") {
    options?.onStage?.("parser");
    options?.onProgress?.({ roundsParsed: event.roundsParsed });
    return currentReplay;
  }

  if (event.type === "result") {
    return event.replay;
  }

  if (event.type === "error") {
    throw new Error(event.error || "Demo parse failed.");
  }

  return currentReplay;
}

function isReplayPayload(value: unknown): value is Record<string, unknown> {
  if (value == null || typeof value !== "object") {
    return false;
  }

  return "format" in value && "rounds" in value;
}

async function parseParserError(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string };
    if (payload.error) {
      return payload.error;
    }
  } catch {
    // Fall through to generic response text.
  }

  return `Failed to parse demo: ${response.status} ${response.statusText}`;
}

function formatReplayErrors(errors: string[]) {
  if (errors.length === 0) {
    return "Replay validation failed.";
  }

  return ["Replay validation failed:", ...errors].join("\n");
}
