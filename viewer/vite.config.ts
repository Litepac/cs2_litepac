import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";

const rootDir = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = path.resolve(rootDir, "..");
const parserRoot = path.resolve(repoRoot, "parser");

function localParserBridgePlugin(): Plugin {
  let parserProcess: ChildProcess | null = null;

  return {
    name: "local-parser-bridge",
    apply: "serve",
    configureServer(server) {
      if (parserProcess != null) {
        return;
      }

      const command = process.platform === "win32" ? "go.exe" : "go";
      parserProcess = spawn(command, ["run", "./cmd/mastermind-api"], {
        cwd: parserRoot,
        stdio: "ignore",
        windowsHide: true,
      });

      const stopParserProcess = () => {
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
  plugins: [react(), ...(command === "serve" ? [localParserBridgePlugin()] : [])],
  publicDir: path.resolve(repoRoot, "assets"),
  server: {
    fs: {
      allow: [repoRoot],
    },
  },
}));
