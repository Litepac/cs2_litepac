import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";

const rootDir = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = path.resolve(rootDir, "..");
const parserRoot = path.resolve(repoRoot, "parser");

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

export default defineConfig(({ command }) => ({
  plugins: [react(), ...(command === "serve" ? [localParserApiPlugin()] : [])],
  publicDir: path.resolve(repoRoot, "assets"),
  server: {
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
