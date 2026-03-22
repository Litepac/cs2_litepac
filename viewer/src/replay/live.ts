import type { Replay, Round } from "./types";
import { teamName } from "./derived";
import { utilityMatchesFocus, type UtilityFocus } from "./utilityFilter";
import { activeUtilityCount as countActiveUtilities, isUtilityVisibleAtTick } from "./utility";
import type { WeaponClass } from "./weapons";

export type LivePlayerState = {
  alive: boolean;
  armor: number | null;
  decoys: number | null;
  fireGrenades: number | null;
  flashbangs: number | null;
  heGrenades: number | null;
  hasHelmet: boolean;
  hasBomb: boolean;
  health: number | null;
  mainWeapon: string | null;
  money: number | null;
  name: string;
  playerId: string;
  side: "T" | "CT";
  smokes: number | null;
  teamId: string;
  activeWeapon: string | null;
  activeWeaponClass: WeaponClass | null;
};

export type RoundLiveState = {
  activeUtilityCount: number;
  bombCarrier: LivePlayerState | null;
  ctAlive: number;
  selectedPlayer: LivePlayerState | null;
  tAlive: number;
  players: LivePlayerState[];
};

export function roundLiveState(
  replay: Replay,
  round: Round,
  currentTick: number,
  selectedPlayerId: string | null,
  utilityFocus: UtilityFocus,
): RoundLiveState {
  const players = livePlayersAtTick(replay, round, currentTick);
  return {
    activeUtilityCount: activeUtilityCount(round, currentTick, utilityFocus),
    bombCarrier: players.find((entry) => entry.hasBomb) ?? null,
    ctAlive: players.filter((entry) => entry.side === "CT" && entry.alive).length,
    selectedPlayer: players.find((entry) => entry.playerId === selectedPlayerId) ?? null,
    tAlive: players.filter((entry) => entry.side === "T" && entry.alive).length,
    players,
  };
}

export function livePlayersAtTick(replay: Replay, round: Round, currentTick: number): LivePlayerState[] {
  return round.playerStreams
    .map((stream) => {
      if (stream.side == null) {
        return null;
      }

      const player = replay.players.find((entry) => entry.playerId === stream.playerId);
      if (!player) {
        return null;
      }

      const sampleIndex = currentTick - stream.sampleOriginTick;
      const alive = sampleIndex >= 0 && sampleIndex < stream.alive.length ? stream.alive[sampleIndex] : false;
      const health = sampleIndex >= 0 && sampleIndex < stream.health.length ? stream.health[sampleIndex] : null;
      const armor = sampleIndex >= 0 && sampleIndex < stream.armor.length ? stream.armor[sampleIndex] : null;
      const hasHelmet = sampleIndex >= 0 && sampleIndex < stream.hasHelmet.length ? stream.hasHelmet[sampleIndex] : false;
      const money = sampleIndex >= 0 && sampleIndex < stream.money.length ? stream.money[sampleIndex] : null;
      const activeWeapon =
        sampleIndex >= 0 && sampleIndex < stream.activeWeapon.length ? stream.activeWeapon[sampleIndex] : null;
      const activeWeaponClass =
        sampleIndex >= 0 && sampleIndex < stream.activeWeaponClass.length ? stream.activeWeaponClass[sampleIndex] : null;
      const mainWeapon =
        sampleIndex >= 0 && sampleIndex < stream.mainWeapon.length ? stream.mainWeapon[sampleIndex] : null;
      const flashbangs =
        sampleIndex >= 0 && sampleIndex < stream.flashbangs.length ? stream.flashbangs[sampleIndex] : null;
      const smokes = sampleIndex >= 0 && sampleIndex < stream.smokes.length ? stream.smokes[sampleIndex] : null;
      const heGrenades =
        sampleIndex >= 0 && sampleIndex < stream.heGrenades.length ? stream.heGrenades[sampleIndex] : null;
      const fireGrenades =
        sampleIndex >= 0 && sampleIndex < stream.fireGrenades.length ? stream.fireGrenades[sampleIndex] : null;
      const decoys = sampleIndex >= 0 && sampleIndex < stream.decoys.length ? stream.decoys[sampleIndex] : null;
      const hasBomb = sampleIndex >= 0 && sampleIndex < stream.hasBomb.length ? stream.hasBomb[sampleIndex] : false;

      return {
        alive,
        armor: alive ? armor : armor ?? null,
        decoys,
        fireGrenades,
        flashbangs,
        heGrenades,
        hasHelmet,
        hasBomb,
        health: alive ? health : 0,
        mainWeapon,
        money,
        name: player.displayName,
        playerId: player.playerId,
        side: stream.side,
        smokes,
        teamId: player.teamId,
        activeWeapon,
        activeWeaponClass,
      } satisfies LivePlayerState;
    })
    .filter((entry): entry is LivePlayerState => entry !== null)
    .sort((left, right) => {
      if (left.alive !== right.alive) {
        return left.alive ? -1 : 1;
      }

      return left.name.localeCompare(right.name);
    });
}

export function playerTeamLabel(replay: Replay, player: LivePlayerState) {
  return teamName(replay, player.teamId);
}

function activeUtilityCount(round: Round, currentTick: number, utilityFocus: UtilityFocus) {
  if (utilityFocus === "all") {
    return countActiveUtilities(round, currentTick);
  }

  return round.utilityEntities.filter(
    (utility) => utilityMatchesFocus(utility.kind, utilityFocus) && isUtilityVisibleAtTick(utility, currentTick),
  ).length;
}
