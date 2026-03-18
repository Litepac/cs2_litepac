import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react()],
  publicDir: path.resolve(rootDir, "../assets"),
  server: {
    fs: {
      allow: [path.resolve(rootDir, "..")],
    },
  },
});
