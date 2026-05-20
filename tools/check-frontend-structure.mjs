import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const failures = [];

const bannedDirectories = [
  "assets",
  path.join("viewer", "src", "assets"),
  path.join("viewer", "src", "maps"),
];

const retiredFiles = [
  path.join("viewer", "src", "controls", "MapHud.tsx"),
  path.join("viewer", "src", "controls", "PlaybackHeader.tsx"),
  path.join("viewer", "src", "controls", "RosterPanel.tsx"),
  path.join("viewer", "src", "controls", "Sidebar.tsx"),
  path.join("viewer", "src", "replay", "playbackClock.ts"),
  path.join("viewer", "src", "selection", "RoundStrip.tsx"),
];

const allowedGlobalCss = new Set([
  normalize(path.join("viewer", "src", "app", "app.css")),
  normalize(path.join("viewer", "src", "app", "legacy-app.css")),
  normalize(path.join("viewer", "src", "app", "styles", "landing.css")),
  normalize(path.join("viewer", "src", "app", "styles", "shell.css")),
  normalize(path.join("viewer", "src", "controls", "ReplayMapFirstPage.css")),
]);

const bannedTextPatterns = [
  {
    pattern: /assets[\\/]maps/g,
    message: "Use public/maps for browser-served map assets; root assets/maps is retired.",
  },
  {
    pattern: /\.\.[\\/]assets/g,
    message: "Viewer source imports must use viewer/src/icons or public assets, not viewer/src/assets.",
  },
  {
    pattern: /viewer[\\/]src[\\/]assets/g,
    message: "viewer/src/assets is retired; viewer source-owned icons live in viewer/src/icons.",
  },
  {
    pattern: /viewer[\\/]src[\\/]maps/g,
    message: "viewer/src/maps is retired; map transform source lives in viewer/src/mapGeometry.",
  },
];

const retiredClassPatterns = [
  /\.ingest-/,
  /\.map-hud(?:[\s.{:#,[>+~-]|$)/,
  /\.playback-header(?:[\s.{:#,[>+~-]|$)/,
  /\.roster-panel(?:[\s.{:#,[>+~-]|$)/,
  /\.roster-card(?:[\s.{:#,[>+~-]|$)/,
  /\.roster-item(?:[\s.{:#,[>+~-]|$)/,
  /\.round-pill(?:[\s.{:#,[>+~-]|$)/,
  /\.selected-player-card(?:[\s.{:#,[>+~-]|$)/,
  /\.team-score(?:[\s.{:#,[>+~-]|$)/,
  /\.meta-chip(?:[\s.{:#,[>+~-]|$)/,
  /\.header-meta(?:[\s.{:#,[>+~-]|$)/,
];

const textExtensions = new Set([".css", ".go", ".html", ".js", ".json", ".md", ".mjs", ".ts", ".tsx"]);

for (const relativePath of bannedDirectories) {
  if (await pathExists(path.join(repoRoot, relativePath))) {
    fail(relativePath, "Retired ownership directory still exists.");
  }
}

for (const relativePath of retiredFiles) {
  if (await pathExists(path.join(repoRoot, relativePath))) {
    fail(relativePath, "Retired frontend file was reintroduced.");
  }
}

await validatePublicMaps();

const files = await collectFiles(repoRoot);
for (const filePath of files) {
  const relativePath = normalize(path.relative(repoRoot, filePath));
  const extension = path.extname(filePath);
  const isThisScript = relativePath === "tools/check-frontend-structure.mjs";
  const isPlanningHistory = relativePath === "plans.md";

  if (relativePath.startsWith("viewer/src/") && extension === ".css") {
    const isModule = relativePath.endsWith(".module.css");
    if (!isModule && !allowedGlobalCss.has(relativePath)) {
      fail(relativePath, "New component CSS should be a CSS Module. Add to the allowlist only for true global surfaces.");
    }
  }

  if (!textExtensions.has(extension) || isThisScript || isPlanningHistory) {
    continue;
  }

  const content = await readFile(filePath, "utf8");
  for (const { pattern, message } of bannedTextPatterns) {
    pattern.lastIndex = 0;
    if (pattern.test(content)) {
      fail(relativePath, message);
    }
  }

  if (extension === ".css") {
    for (const pattern of retiredClassPatterns) {
      if (pattern.test(content)) {
        fail(relativePath, `Retired global selector matched ${pattern}. Remove stale CSS instead of carrying it forward.`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error("Frontend structure check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Frontend structure check passed.");

function fail(relativePath, message) {
  failures.push(`${normalize(relativePath)}: ${message}`);
}

async function pathExists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function collectFiles(root) {
  const ignoredDirectories = new Set([".git", ".tmp-chrome-profile", "dist", "node_modules"]);
  const found = [];

  async function walk(currentPath) {
    const entries = await readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
        continue;
      }

      const entryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath);
      } else if (entry.isFile()) {
        found.push(entryPath);
      }
    }
  }

  await walk(root);
  return found;
}

async function validatePublicMaps() {
  const mapsRoot = path.join(repoRoot, "public", "maps");
  const entries = await readdir(mapsRoot, { withFileTypes: true });
  const mapDirectories = entries.filter((entry) => entry.isDirectory());

  if (mapDirectories.length === 0) {
    fail("public/maps", "No map asset directories were found.");
    return;
  }

  for (const entry of mapDirectories) {
    const mapRoot = path.join(mapsRoot, entry.name);
    const relativeRoot = normalize(path.relative(repoRoot, mapRoot));
    const calibrationPath = path.join(mapRoot, "calibration.json");
    const radarPath = path.join(mapRoot, "radar.png");
    const bannerPath = path.join(mapRoot, "banner.svg");

    if (!(await pathExists(calibrationPath))) {
      fail(relativeRoot, "Map directory is missing calibration.json.");
      continue;
    }

    if (!(await pathExists(radarPath))) {
      fail(relativeRoot, "Map directory is missing radar.png.");
    }

    if (!(await pathExists(bannerPath))) {
      fail(relativeRoot, "Map directory is missing banner.svg.");
    }

    let calibration;
    try {
      calibration = JSON.parse(await readFile(calibrationPath, "utf8"));
    } catch (error) {
      fail(normalize(path.relative(repoRoot, calibrationPath)), `Map calibration JSON is invalid: ${error.message}`);
      continue;
    }

    if (calibration?.mapId !== entry.name) {
      fail(normalize(path.relative(repoRoot, calibrationPath)), `mapId must match directory name ${entry.name}.`);
    }

    if (typeof calibration?.displayName !== "string" || calibration.displayName.trim() === "") {
      fail(normalize(path.relative(repoRoot, calibrationPath)), "displayName must be a non-empty string.");
    }

    if (typeof calibration?.radarImageKey !== "string" || calibration.radarImageKey.trim() === "") {
      fail(normalize(path.relative(repoRoot, calibrationPath)), "radarImageKey must be a non-empty string.");
    } else {
      const radarImagePath = path.join(mapsRoot, calibration.radarImageKey);
      if (!(await pathExists(radarImagePath))) {
        fail(normalize(path.relative(repoRoot, calibrationPath)), `radarImageKey target does not exist: ${calibration.radarImageKey}`);
      }
    }

    const coordinateSystem = calibration?.coordinateSystem;
    for (const key of ["worldXMin", "worldXMax", "worldYMin", "worldYMax", "rotateDegrees"]) {
      if (!Number.isFinite(coordinateSystem?.[key])) {
        fail(normalize(path.relative(repoRoot, calibrationPath)), `coordinateSystem.${key} must be finite.`);
      }
    }
  }
}

function normalize(value) {
  return value.replaceAll(path.sep, "/");
}
