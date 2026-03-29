declare function require(name: string): any;
declare const process: { argv: string[] };

const { readdirSync, readFileSync } = require("fs");
const path = require("path");

import { deriveMatchStats } from "../viewer/src/replay/matchStats";
import {
  accumulateStreamZoneOccupancy,
  createEmptySideZoneTallies,
  inspectSideZoneShares,
} from "../viewer/src/replay/positionalRoles";
import type { Replay } from "../viewer/src/replay/types";

const replayDir = path.resolve("testdata/replays");
const targetMap = process.argv.find((arg) => arg.startsWith("--map="))?.slice("--map=".length) ?? null;
const showZones = process.argv.includes("--zones");

for (const fileName of readdirSync(replayDir).filter((name) => name.endsWith(".json")).sort()) {
  const filePath = path.join(replayDir, fileName);
  const replay = JSON.parse(readFileSync(filePath, "utf-8")) as Replay;
  if (targetMap && replay.map.mapId !== targetMap) {
    continue;
  }
  const stats = deriveMatchStats(replay, "all");
  const tickRate = Math.max(1, replay.match.tickRate || replay.sourceDemo.tickRate || 64);
  const playerZoneTallies = new Map<string, ReturnType<typeof createEmptySideZoneTallies>>();

  for (const round of replay.rounds) {
    for (const stream of round.playerStreams) {
      if (!playerZoneTallies.has(stream.playerId)) {
        playerZoneTallies.set(stream.playerId, createEmptySideZoneTallies());
      }
      accumulateStreamZoneOccupancy(replay.map, round, stream, playerZoneTallies.get(stream.playerId)!, tickRate);
    }
  }

  console.log(`\n=== ${fileName} :: ${replay.map.mapId} ===`);

  for (const team of stats.teams) {
    console.log(`\n${team.isWinner ? "WINNER" : "RUNNER-UP"} ${team.teamName} (${team.finalScore})`);
    for (const player of team.players) {
      const ctRole = player.role.ctTendency?.label ?? "n/a";
      const tRole = player.role.tTendency?.label ?? "n/a";
      const ctZone = player.role.ctTendency?.zoneLabel ?? "n/a";
      const tZone = player.role.tTendency?.zoneLabel ?? "n/a";
      console.log(
        `- ${player.displayName}\n` +
          `  CT: ${ctRole} [${ctZone}] | T: ${tRole} [${tZone}]\n` +
          `  Note: ${player.role.matchNote}`,
      );

      if (showZones) {
        const tallies = playerZoneTallies.get(player.playerId);
        const ctZones = tallies ? inspectSideZoneShares(replay.map, tallies.CT) : [];
        const tZones = tallies ? inspectSideZoneShares(replay.map, tallies.T) : [];
        if (ctZones.length > 0 || tZones.length > 0) {
          console.log(
            `  Raw zones: CT ${ctZones.map((zone) => `${zone.zoneName} ${Math.round(zone.share * 100)}%`).join(", ") || "n/a"} | ` +
              `T ${tZones.map((zone) => `${zone.zoneName} ${Math.round(zone.share * 100)}%`).join(", ") || "n/a"}`,
          );
        }
      }
    }
  }
}
