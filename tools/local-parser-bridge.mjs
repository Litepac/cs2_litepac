import { constants as fsConstants } from "node:fs";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { access, appendFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const parserRoot = path.resolve(repoRoot, "parser");
const parserExe = path.resolve(parserRoot, "fixtureparse.exe");
const assetsRoot = path.resolve(repoRoot, "assets", "maps");
const schemaPath = path.resolve(repoRoot, "schema", "mastermind.replay.schema.json");
const feedbackLogPath = path.resolve(repoRoot, "friend-logs", "feedback.ndjson");
const feedbackReadableLogPath = path.resolve(repoRoot, "friend-logs", "feedback.log");
const usageLogPath = path.resolve(repoRoot, "friend-logs", "usage.ndjson");
const usageReadableLogPath = path.resolve(repoRoot, "friend-logs", "usage.log");
const listenPort = Number(process.env.LITEPAC_PARSER_BRIDGE_PORT || 4318);
const maxUploadBytes = 2 * 1024 * 1024 * 1024;
const maxFeedbackBytes = 32 * 1024;
const maxFeedbackTextLength = 4000;
const maxUsageEventBytes = 32 * 1024;

await assertParserExecutableAvailable();

const server = createServer(async (request, response) => {
  applyCors(response);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.url?.startsWith("/api/health")) {
    if (request.method !== "GET") {
      writeJson(response, 405, { error: "method not allowed" });
      return;
    }

    writeJson(response, 200, {
      ok: true,
      service: "mastermind-parser-api",
      bridge: "node-fixtureparse",
    });
    return;
  }

  if (request.url === "/api/parse-demo") {
    if (request.method !== "POST") {
      writeJson(response, 405, { error: "method not allowed" });
      return;
    }

    try {
      await parseDemoUpload(request, response);
    } catch (error) {
      if (!response.headersSent) {
        writeJson(response, 400, {
          error: error instanceof Error ? error.message : String(error),
        });
        return;
      }

      response.write(`${JSON.stringify({
        type: "error",
        error: error instanceof Error ? error.message : String(error),
      })}\n`);
      response.end();
    }
    return;
  }

  if (request.url === "/api/usage-events") {
    if (request.method !== "POST") {
      writeJson(response, 405, { error: "method not allowed" });
      return;
    }

    try {
      await appendUsageEvent(request);
    } catch (error) {
      process.stderr.write(`usage-event logging failed: ${error instanceof Error ? error.message : String(error)}\n`);
    }
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.url === "/api/feedback") {
    if (request.method !== "POST") {
      writeJson(response, 405, { error: "method not allowed" });
      return;
    }

    try {
      await appendFeedbackSubmission(request);
    } catch (error) {
      writeJson(response, 400, {
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }
    response.writeHead(204);
    response.end();
    return;
  }

  writeJson(response, 404, { error: "not found" });
});

server.listen(listenPort, "127.0.0.1", () => {
  process.stdout.write(`local parser bridge listening on http://127.0.0.1:${listenPort}\n`);
});

async function parseDemoUpload(request, response) {
  await assertParserExecutableAvailable();

  const contentType = request.headers["content-type"] ?? "";
  const boundary = parseBoundary(contentType);
  if (!boundary) {
    throw new Error("missing multipart boundary");
  }

  const body = await readRequestBody(request, maxUploadBytes);
  const upload = extractDemoPart(body, boundary);
  const safeFileName = sanitizeDemoFileName(upload.fileName);
  const tempRoot = await mkdtemp(path.join(tmpdir(), "litepac-bridge-"));
  const demoDir = path.join(tempRoot, "demos");
  const outDir = path.join(tempRoot, "replays");
  const demoPath = path.join(demoDir, safeFileName);
  const replayPath = path.join(outDir, `${safeFileName.replace(/\.dem$/i, "")}.replay.json`);

  response.writeHead(200, {
    "Content-Type": "application/x-ndjson",
    "Cache-Control": "no-store",
    "X-Accel-Buffering": "no",
  });
  response.write(`${JSON.stringify({ type: "progress", roundsParsed: 0 })}\n`);

  try {
    await mkdir(demoDir, { recursive: true });
    await mkdir(outDir, { recursive: true });
    await writeFile(demoPath, upload.bytes);
    await execFileAsync(parserExe, [
      "-demo-dir",
      demoDir,
      "-out-dir",
      outDir,
      "-assets-root",
      assetsRoot,
      "-schema",
      schemaPath,
    ], {
      cwd: parserRoot,
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true,
    });

    const replayRaw = (await readFile(replayPath, "utf8")).trim();
    if (!replayRaw) {
      throw new Error("parser produced an empty replay artifact");
    }

    response.write(`${JSON.stringify({
      type: "result",
      replay: JSON.parse(replayRaw),
    })}\n`);
    response.end();
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function assertParserExecutableAvailable() {
  try {
    await access(parserExe, fsConstants.X_OK);
  } catch {
    throw new Error(
      `fallback parser bridge requires ${path.relative(repoRoot, parserExe)}; build it with: cd parser && go build -o fixtureparse.exe .\\cmd\\fixtureparse`,
    );
  }
}

function applyCors(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function writeJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(`${JSON.stringify(payload)}\n`);
}

function parseBoundary(contentType) {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  return (match?.[1] ?? match?.[2] ?? "").trim();
}

async function readRequestBody(request, maxBytes) {
  const chunks = [];
  let totalLength = 0;

  for await (const chunk of request) {
    totalLength += chunk.length;
    if (totalLength > maxBytes) {
      throw new Error("uploaded demo is too large");
    }
    chunks.push(chunk);
  }

  return Buffer.concat(chunks, totalLength);
}

function extractDemoPart(body, boundary) {
  const boundaryMarker = Buffer.from(`--${boundary}`);
  const firstBoundaryIndex = body.indexOf(boundaryMarker);
  if (firstBoundaryIndex < 0) {
    throw new Error("multipart boundary not found");
  }

  let cursor = firstBoundaryIndex + boundaryMarker.length;
  if (body[cursor] === 13 && body[cursor + 1] === 10) {
    cursor += 2;
  }

  const headerEnd = body.indexOf(Buffer.from("\r\n\r\n"), cursor);
  if (headerEnd < 0) {
    throw new Error("multipart headers not found");
  }

  const headerText = body.toString("utf8", cursor, headerEnd);
  if (!/name="demo"/i.test(headerText)) {
    throw new Error("multipart upload is missing the demo field");
  }

  const fileName = (/filename="([^"]*)"/i.exec(headerText)?.[1] ?? "uploaded-demo.dem").trim();
  const contentStart = headerEnd + 4;
  const contentEnd = body.indexOf(Buffer.from(`\r\n--${boundary}`), contentStart);
  if (contentEnd < 0) {
    throw new Error("multipart demo content terminator not found");
  }

  return {
    bytes: body.subarray(contentStart, contentEnd),
    fileName,
  };
}

function sanitizeDemoFileName(fileName) {
  const baseName = path.basename(fileName.trim()).replace(/[\\/]/g, "_");
  if (!baseName) {
    return "uploaded-demo.dem";
  }

  return /\.dem$/i.test(baseName) ? baseName : `${baseName}.dem`;
}

async function appendUsageEvent(request) {
  const body = await readRequestBody(request, maxUsageEventBytes);
  const payload = JSON.parse(body.toString("utf8"));
  const eventName = typeof payload.event === "string" && payload.event.trim() ? payload.event.trim() : "unknown";
  const entry = {
    event: eventName,
    details: payload.details && typeof payload.details === "object" ? payload.details : undefined,
    host: request.headers.host || undefined,
    method: request.method,
    origin: request.headers.origin || undefined,
    path: request.url,
    remote: request.socket.remoteAddress || undefined,
    timestamp: new Date().toISOString(),
    userAgent: request.headers["user-agent"] || undefined,
  };
  const line = `${JSON.stringify(entry)}\n`;
  process.stdout.write(line);
  await mkdir(path.dirname(usageLogPath), { recursive: true });
  await appendFile(usageLogPath, line, "utf8");

  const localTimestamp = formatLocalTimestamp(entry.timestamp);
  const pageLabel =
    typeof entry.details?.path === "string" && entry.details.path.trim()
      ? entry.details.path.trim()
      : typeof entry.details?.shellPage === "string" && entry.details.shellPage.trim()
        ? entry.details.shellPage.trim()
        : "unknown-page";
  const mapLabel =
    typeof entry.details?.mapName === "string" && entry.details.mapName.trim()
      ? ` | ${entry.details.mapName.trim()}`
      : "";
  const matchLabel =
    typeof entry.details?.matchId === "string" && entry.details.matchId.trim()
      ? ` | match=${entry.details.matchId.trim()}`
      : "";
  const statusLabel =
    typeof entry.details?.error === "string" && entry.details.error.trim()
      ? ` | error=${entry.details.error.trim()}`
      : "";
  await appendFile(
    usageReadableLogPath,
    `[${localTimestamp}] ${entry.event} | ${pageLabel}${mapLabel}${matchLabel}${statusLabel}\n`,
    "utf8",
  );
}

async function appendFeedbackSubmission(request) {
  const body = await readRequestBody(request, maxFeedbackBytes);
  const payload = JSON.parse(body.toString("utf8"));
  const message = typeof payload.message === "string" ? payload.message.trim() : "";
  if (!message) {
    throw new Error("feedback message is required");
  }

  if ([...message].length > maxFeedbackTextLength) {
    throw new Error("feedback message is too long");
  }

  const entry = {
    context: payload.context && typeof payload.context === "object" ? payload.context : undefined,
    host: request.headers.host || undefined,
    message,
    method: request.method,
    origin: request.headers.origin || undefined,
    path: request.url,
    remote: request.socket.remoteAddress || undefined,
    timestamp: new Date().toISOString(),
    userAgent: request.headers["user-agent"] || undefined,
  };
  const line = `${JSON.stringify(entry)}\n`;
  process.stdout.write(line);
  await mkdir(path.dirname(feedbackLogPath), { recursive: true });
  await appendFile(feedbackLogPath, line, "utf8");

  const localTimestamp = formatLocalTimestamp(entry.timestamp);
  const pageLabel =
    typeof entry.context?.shellPage === "string" && entry.context.shellPage.trim()
      ? entry.context.shellPage.trim()
      : "unknown-page";
  const mapLabel =
    typeof entry.context?.mapName === "string" && entry.context.mapName.trim()
      ? ` | ${entry.context.mapName.trim()}`
      : "";
  const roundLabel =
    typeof entry.context?.replayRoundNumber === "number"
      ? ` | R${entry.context.replayRoundNumber}`
      : "";
  await appendFile(
    feedbackReadableLogPath,
    `[${localTimestamp}] ${pageLabel}${mapLabel}${roundLabel}\n${entry.message}\n\n`,
    "utf8",
  );
}

function formatLocalTimestamp(timestamp) {
  if (typeof timestamp !== "string" || !timestamp.trim()) {
    return "unknown-time";
  }

  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return timestamp;
  }

  const pad = (value) => String(value).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())} ${pad(parsed.getHours())}:${pad(parsed.getMinutes())}:${pad(parsed.getSeconds())}`;
}
