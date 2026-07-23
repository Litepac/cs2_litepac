import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const distRoot = path.resolve(repoRoot, "viewer", "dist");
const maximumReleaseBytes = 50 * 1024 * 1024;
const failures = [];

const files = await collectFiles(distRoot);
const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
const relativePaths = files.map((file) => normalize(path.relative(distRoot, file.path)));

for (const relativePath of relativePaths) {
  const segments = relativePath.split("/");
  if (segments[0] === "models" || segments[0] === "fixtures" || segments.includes("3d")) {
    failures.push(`${relativePath}: development-only replay assets must not ship in the release build.`);
  }
  if (path.basename(relativePath).startsWith("Replay3DStage-")) {
    failures.push(`${relativePath}: the development-only 3D renderer must be tree-shaken from release builds.`);
  }
}

for (const requiredPath of ["brand/demoread-logo.png", "maps/de_mirage/radar.png", "maps/de_mirage/calibration.json"]) {
  if (!relativePaths.includes(requiredPath)) {
    failures.push(`${requiredPath}: required 2D release asset is missing.`);
  }
}

if (totalBytes > maximumReleaseBytes) {
  failures.push(
    `release output is ${(totalBytes / 1024 / 1024).toFixed(2)} MiB; expected no more than ${
      maximumReleaseBytes / 1024 / 1024
    } MiB.`,
  );
}

if (failures.length > 0) {
  console.error("Release build check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Release build check passed (${files.length} files, ${(totalBytes / 1024 / 1024).toFixed(2)} MiB).`);

async function collectFiles(root) {
  const found = [];

  async function walk(currentPath) {
    const entries = await readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath);
      } else if (entry.isFile()) {
        found.push({
          path: entryPath,
          size: (await stat(entryPath)).size,
        });
      }
    }
  }

  await walk(root);
  return found;
}

function normalize(value) {
  return value.replaceAll(path.sep, "/");
}
