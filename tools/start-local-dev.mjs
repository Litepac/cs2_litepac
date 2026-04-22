import { spawn } from "node:child_process";
import { request } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const viewerRoot = path.resolve(repoRoot, "viewer");
const parserRoot = path.resolve(repoRoot, "parser");

const isWindows = process.platform === "win32";
const goCommand = isWindows ? "go.exe" : "go";
const nodeCommand = isWindows ? "node.exe" : "node";
const npmCommand = isWindows ? "npm.cmd" : "npm";

let bridgeProcess = null;
let parserProcess = null;
let viewerProcess = null;
let shuttingDown = false;

async function main() {
  const parserApi = await probeHealth("http://127.0.0.1:4318/api/health");
  if (parserApi == null) {
    const goReady = await startGoParserApi();
    if (!goReady) {
      process.stderr.write("[local-dev] Go parser API did not become healthy; trying fallback bridge\n");
      await startFallbackBridge();
    }
  } else {
    const mode = typeof parserApi.mode === "string" ? parserApi.mode : "unknown";
    const bridge = typeof parserApi.bridge === "string" ? ` (${parserApi.bridge})` : "";
    process.stdout.write(`[local-dev] reusing existing parser API on http://127.0.0.1:4318: ${mode}${bridge}\n`);
    if (mode !== "go-api") {
      process.stdout.write("[local-dev] existing parser is not the preferred Go API; stop it first if you expected direct Go runtime.\n");
    }
  }

  viewerProcess = spawn(npmCommand, ["run", "dev", "--", "--host", "127.0.0.1", "--port", "4173"], {
    cwd: viewerRoot,
    env: {
      ...process.env,
      LITEPAC_SKIP_LOCAL_PARSER_API: "1",
    },
    shell: isWindows,
    stdio: "inherit",
    windowsHide: false,
  });
  viewerProcess.once("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }
    process.stderr.write(
      `[local-dev] viewer exited (${signal ? `signal ${signal}` : `code ${code ?? "unknown"}`})\n`,
    );
    shutdown(code ?? 1);
  });
}

async function startGoParserApi() {
  parserProcess = spawn(goCommand, ["run", "./cmd/mastermind-api"], {
    cwd: parserRoot,
    env: {
      ...process.env,
      LITEPAC_FEEDBACK_LOG: path.resolve(repoRoot, "friend-logs", "feedback.ndjson"),
      LITEPAC_USAGE_LOG: path.resolve(repoRoot, "friend-logs", "usage.ndjson"),
    },
    stdio: "inherit",
    windowsHide: false,
  });
  parserProcess.once("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }
    process.stderr.write(
      `[local-dev] Go parser API exited early (${signal ? `signal ${signal}` : `code ${code ?? "unknown"}`})\n`,
    );
  });

  const ready = await waitForHealth("http://127.0.0.1:4318/api/health", 15000);
  if (!ready) {
    killProcess(parserProcess);
    parserProcess = null;
  }

  return ready;
}

async function startFallbackBridge() {
  bridgeProcess = spawn(nodeCommand, ["tools/local-parser-bridge.mjs"], {
    cwd: repoRoot,
    env: process.env,
    stdio: "inherit",
    windowsHide: false,
  });
  bridgeProcess.once("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }
    process.stderr.write(
      `[local-dev] parser bridge exited early (${signal ? `signal ${signal}` : `code ${code ?? "unknown"}`})\n`,
    );
    shutdown(1);
  });

  const bridgeReady = await waitForHealth("http://127.0.0.1:4318/api/health", 10000);
  if (!bridgeReady) {
    throw new Error("parser bridge did not become healthy on 127.0.0.1:4318");
  }
}

async function probeHealth(url) {
  try {
    return await getJson(url);
  } catch {
    return null;
  }
}

async function waitForHealth(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if ((await probeHealth(url))?.ok === true) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    const req = request(url, { method: "GET" }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        if ((response.statusCode ?? 500) >= 400) {
          reject(new Error(`HTTP ${response.statusCode ?? "unknown"}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });
    req.once("error", reject);
    req.end();
  });
}

function killProcess(child) {
  if (child == null || child.killed) {
    return;
  }

  child.kill("SIGTERM");
}

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  killProcess(viewerProcess);
  killProcess(parserProcess);
  killProcess(bridgeProcess);
  setTimeout(() => {
    process.exit(exitCode);
  }, 50).unref();
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
process.on("exit", () => {
  shuttingDown = true;
  killProcess(viewerProcess);
  killProcess(parserProcess);
  killProcess(bridgeProcess);
});

main().catch((error) => {
  process.stderr.write(`[local-dev] ${error instanceof Error ? error.message : String(error)}\n`);
  shutdown(1);
});
