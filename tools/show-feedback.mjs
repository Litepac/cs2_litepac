import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const feedbackLogPath = path.resolve(repoRoot, "friend-logs", "feedback.ndjson");

let rawLog = "";
try {
  rawLog = await readFile(feedbackLogPath, "utf8");
} catch (error) {
  if (error?.code === "ENOENT") {
    console.log("No feedback log yet.");
    process.exit(0);
  }
  throw error;
}

const entries = rawLog
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  })
  .filter((entry) => entry && typeof entry === "object");

if (entries.length === 0) {
  console.log("No readable feedback entries yet.");
  process.exit(0);
}

for (const entry of entries.slice(-40)) {
  const timestamp = formatTimestamp(entry.timestamp);
  const shellPage = entry.context?.shellPage ? String(entry.context.shellPage) : "unknown-page";
  const mapName = entry.context?.mapName ? ` | ${entry.context.mapName}` : "";
  const roundNumber =
    typeof entry.context?.replayRoundNumber === "number" ? ` | R${entry.context.replayRoundNumber}` : "";
  const message = typeof entry.message === "string" ? entry.message : "";

  console.log(`[${timestamp}] ${shellPage}${mapName}${roundNumber}`);
  console.log(message);
  console.log("");
}

function formatTimestamp(timestamp) {
  if (typeof timestamp !== "string" || !timestamp.trim()) {
    return "unknown-time";
  }

  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return timestamp;
  }

  return parsed.toLocaleString("da-DK", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    year: "numeric",
  });
}
