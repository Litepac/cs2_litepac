import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

const rootDir = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = path.resolve(rootDir, "..");
const parserRoot = path.resolve(repoRoot, "parser");
const publicRoot = path.resolve(repoRoot, "public");
const testReplayRoot = path.resolve(repoRoot, "testdata", "replays");

const RELEASE_PUBLIC_EXCLUDES = new Set(["fixtures", "models"]);

function releasePublicAssetsPlugin(): Plugin {
  return {
    name: "release-public-assets",
    apply: "build",
    async closeBundle() {
      await copyReleasePublicAssets(publicRoot, path.resolve(rootDir, "dist"));
    },
  };
}

async function copyReleasePublicAssets(sourceRoot: string, destinationRoot: string, relativePath = ""): Promise<void> {
  const sourcePath = path.resolve(sourceRoot, relativePath);
  const entries = await fs.promises.readdir(sourcePath, { withFileTypes: true });

  for (const entry of entries) {
    const nextRelativePath = path.join(relativePath, entry.name);
    const pathSegments = nextRelativePath.split(path.sep);
    if (
      RELEASE_PUBLIC_EXCLUDES.has(pathSegments[0]) ||
      pathSegments.includes("3d") ||
      pathSegments.includes("bomb-damage")
    ) {
      continue;
    }

    const nextSourcePath = path.resolve(sourceRoot, nextRelativePath);
    const nextDestinationPath = path.resolve(destinationRoot, nextRelativePath);
    if (entry.isDirectory()) {
      await fs.promises.mkdir(nextDestinationPath, { recursive: true });
      await copyReleasePublicAssets(sourceRoot, destinationRoot, nextRelativePath);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }

    await fs.promises.mkdir(path.dirname(nextDestinationPath), { recursive: true });
    await fs.promises.copyFile(nextSourcePath, nextDestinationPath);
  }
}

function localParserApiPlugin(): Plugin {
  let parserProcess: ChildProcess | null = null;
  let parserProcessStopping = false;

  return {
    name: "local-parser-api",
    apply: "serve",
    configureServer(server) {
      if (parserProcess != null) {
        return;
      }

      const command = process.platform === "win32" ? "go.exe" : "go";
      parserProcess = spawn(command, ["run", "./cmd/mastermind-api"], {
        cwd: parserRoot,
        env: {
          ...process.env,
          LITEPAC_FEEDBACK_LOG: path.resolve(repoRoot, "friend-logs", "feedback.ndjson"),
          LITEPAC_USAGE_LOG: path.resolve(repoRoot, "friend-logs", "usage.ndjson"),
        },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
      parserProcess.stdout?.on("data", (chunk) => {
        server.config.logger.info(`[parser-api] ${String(chunk).trimEnd()}`);
      });
      parserProcess.stderr?.on("data", (chunk) => {
        server.config.logger.warn(`[parser-api] ${String(chunk).trimEnd()}`);
      });
      parserProcess.once("error", (error) => {
        server.config.logger.error(`[parser-api] failed to start: ${error.message}`);
      });
      parserProcess.once("exit", (code, signal) => {
        if (parserProcessStopping) {
          return;
        }

        server.config.logger.warn(
          `[parser-api] exited before dev server shutdown (${signal ? `signal ${signal}` : `code ${code ?? "unknown"}`})`,
        );
      });

      const stopParserProcess = () => {
        parserProcessStopping = true;
        if (parserProcess != null && !parserProcess.killed) {
          parserProcess.kill();
        }
        parserProcess = null;
      };

      server.httpServer?.once("close", stopParserProcess);
      process.once("exit", stopParserProcess);
      process.once("SIGINT", stopParserProcess);
      process.once("SIGTERM", stopParserProcess);
    },
  };
}

function localFixturePlugin(): Plugin {
  return {
    name: "local-replay-fixtures",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/fixtures", async (request, response, next) => {
        const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
        const requestedPath = decodeURIComponent(requestUrl.pathname.replace(/^\/+/, ""));

        if (requestedPath === "index.json") {
          try {
            const entries = await fs.promises.readdir(testReplayRoot, { withFileTypes: true });
            const files = entries
              .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
              .map((entry) => ({ fileName: entry.name, label: entry.name }))
              .sort((a, b) => a.fileName.localeCompare(b.fileName));
            response.setHeader("content-type", "application/json; charset=utf-8");
            response.end(JSON.stringify({ files }, null, 2));
          } catch {
            response.statusCode = 404;
            response.end();
          }
          return;
        }

        const safeName = path.basename(requestedPath);
        if (safeName !== requestedPath || !safeName.endsWith(".json")) {
          next();
          return;
        }

        const fixturePath = path.resolve(testReplayRoot, safeName);
        if (!fixturePath.startsWith(testReplayRoot + path.sep)) {
          response.statusCode = 400;
          response.end();
          return;
        }

        fs.createReadStream(fixturePath)
          .once("error", () => {
            response.statusCode = 404;
            response.end();
          })
          .pipe(response);
      });
    },
  };
}

export default defineConfig(({ command }) => ({
  plugins: [
    ...(command === "build" ? [releasePublicAssetsPlugin()] : []),
    ...(command === "serve" ? [localFixturePlugin()] : []),
    ...(command === "serve" && process.env.LITEPAC_SKIP_LOCAL_PARSER_API !== "1" ? [localParserApiPlugin()] : []),
  ],
  optimizeDeps: {
    exclude: [
      "three/examples/jsm/controls/OrbitControls.js",
      "three/examples/jsm/loaders/GLTFLoader.js",
      "three/examples/jsm/utils/SkeletonUtils.js",
    ],
  },
  publicDir: command === "serve" ? publicRoot : false,
  server: {
    allowedHosts: [".trycloudflare.com"],
    strictPort: true,
    fs: {
      allow: [repoRoot],
    },
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4318",
      },
    },
  },
}));
