import { constants as fsConstants } from "node:fs";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
const listenPort = Number(process.env.LITEPAC_PARSER_BRIDGE_PORT || 4318);
const maxUploadBytes = 2 * 1024 * 1024 * 1024;

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
