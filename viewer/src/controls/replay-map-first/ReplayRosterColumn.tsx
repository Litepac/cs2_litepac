import type { CSSProperties } from "react";

import type { Side } from "../../replay/derived";
import type { LivePlayerState } from "../../replay/live";
import type { Replay, Round } from "../../replay/types";
import { normalizeUtilityVisualKind, utilityColorCss, type UtilityVisualKind } from "../../replay/utilityPresentation";
import { formatWeaponLabel, resolvePlayerEquipmentState, type UtilityKind } from "../../replay/weapons";
import { EquipmentIcon } from "../EquipmentIcon";
import { UtilityIcon } from "../UtilityIcon";
import { WeaponGlyph } from "../WeaponGlyph";

type ReplayRosterColumnProps = {
  activeRoundIndex: number;
  currentTick: number;
  players: LivePlayerState[];
  replay: Replay;
  round: Round;
  selectedPlayerId: string | null;
  side: Side;
  onSelectPlayer: (playerId: string) => void;
};

type RailIconItem = {
  active: boolean;
  count: number;
  kind: UtilityVisualKind;
  title: string;
};

type PlayerRoundImpact = {
  assists: number;
  damage: number;
  deaths: number;
  kills: number;
  rounds: number;
};

type PlayerChipStyle = CSSProperties & {
  "--dr-player-health": string;
};

export function ReplayRosterColumn({ activeRoundIndex, currentTick, players, replay, round, selectedPlayerId, side, onSelectPlayer }: ReplayRosterColumnProps) {
  const utilitySummary = teamUtilitySummary(players);
  const equipmentValue = teamEquipmentValue(players);
  const playerImpact = buildPlayerImpactMap(replay, activeRoundIndex, round, currentTick);
  const roundKills = buildRoundKillMap(round, currentTick);

  return (
    <section className={`dr-mapfirst-roster-column dr-mapfirst-roster-column-${side.toLowerCase()}`} aria-label={`${side} roster`}>
      <header className="dr-mapfirst-roster-header">
        <div className="dr-mapfirst-roster-title">
          <span>{side}</span>
          <strong>{players.filter((entry) => entry.alive).length} / {players.length}</strong>
          <span className="dr-mapfirst-roster-equip-value" title="Tracked equipment value from current parser inventory">
            Equip. Value <b>{formatMoney(equipmentValue)}</b>
          </span>
        </div>
        <div className="dr-mapfirst-roster-utility-summary" aria-label={`${side} held utility`}>
          <span><b>{utilitySummary.total}</b> utility</span>
          {utilitySummary.items.map((item) => (
            <span key={item.kind} className="dr-mapfirst-roster-utility-total" style={{ color: utilityColorCss(item.kind) }} title={item.title}>
              <UtilityIcon className="dr-mapfirst-roster-utility-icon" kind={item.kind} title={item.title} />
              <b>{item.count}</b>
            </span>
          ))}
        </div>
      </header>
      <div className="dr-mapfirst-roster-list">
        {players.map((player) => {
          const equipment = resolvePlayerEquipmentState({
            activeWeapon: player.activeWeapon,
            activeWeaponClass: player.activeWeaponClass,
            mainWeapon: player.mainWeapon,
          });
          const utility = utilityInventory(player);
          const primaryWeapon = equipment.primaryWeapon;
          const impact = playerImpact.get(player.playerId) ?? emptyImpact(activeRoundIndex + 1);
          const killsThisRound = roundKills.get(player.playerId) ?? 0;
          const health = player.health == null ? "--" : Math.max(0, player.health);
          const healthPercent = typeof health === "number" ? Math.max(0, Math.min(100, health)) : 0;
          const adr = impact.rounds > 0 ? Math.round(impact.damage / impact.rounds) : 0;
          const chipStyle: PlayerChipStyle = {
            "--dr-player-health": `${healthPercent}%`,
          };

          return (
            <button
              key={player.playerId}
              className={[
                "dr-mapfirst-player-chip",
                `dr-mapfirst-player-chip-${side.toLowerCase()}`,
                player.alive ? "" : "dr-mapfirst-player-chip-dead",
                selectedPlayerId === player.playerId ? "dr-mapfirst-player-chip-active" : "",
              ].filter(Boolean).join(" ")}
              onClick={() => onSelectPlayer(player.playerId)}
              style={chipStyle}
              type="button"
            >
              <span className="dr-mapfirst-player-main">
                <span className="dr-mapfirst-player-health">{health}</span>
                <span className="dr-mapfirst-player-name">{player.name}</span>
                {killsThisRound > 0 ? (
                  <span className="dr-mapfirst-round-kills" title={`${killsThisRound} kills this round`}>
                    <span className="dr-mapfirst-round-kills-icon" aria-hidden="true" />
                    <b>{killsThisRound}</b>
                  </span>
                ) : null}
                <span className="dr-mapfirst-player-money">{formatMoney(player.money)}</span>
              </span>
              <span className="dr-mapfirst-player-loadout">
                {player.alive ? (
                  <span className="dr-mapfirst-weapon-slot dr-mapfirst-weapon-slot-primary">
                    <WeaponGlyph className="dr-mapfirst-weapon-glyph" title={formatWeaponLabel(primaryWeapon)} weaponName={primaryWeapon} />
                    <span>{formatWeaponLabel(primaryWeapon)}</span>
                  </span>
                ) : (
                  <span className="dr-mapfirst-player-dead-state">Eliminated</span>
                )}
              </span>
              <span className="dr-mapfirst-player-meta">
                <span className="dr-mapfirst-equipment-row">
                  {player.armor && player.armor > 0 ? (
                    <span className="dr-mapfirst-equipment-item" title={`${player.armor} armor`}>
                      <EquipmentIcon className="dr-mapfirst-equipment-icon" kind="kevlar" title="Armor" />
                      {player.armor}
                    </span>
                  ) : null}
                  {player.hasHelmet ? (
                    <span className="dr-mapfirst-equipment-item" title="Helmet">
                      <EquipmentIcon className="dr-mapfirst-equipment-icon" kind="helmet" title="Helmet" />
                    </span>
                  ) : null}
                  {player.hasBomb ? (
                    <span className="dr-mapfirst-equipment-item dr-mapfirst-bomb-item" title="Bomb carrier">
                      <UtilityIcon className="dr-mapfirst-equipment-icon" kind="bomb" title="Bomb" />
                    </span>
                  ) : null}
                </span>
                <span className="dr-mapfirst-impact-strip" aria-label={`${player.name} match impact to current tick`}>
                  <span className="dr-mapfirst-impact-group dr-mapfirst-impact-kda">
                    <small>KDA</small>
                    <b>{impact.kills}/{impact.deaths}/{impact.assists}</b>
                  </span>
                  <span className="dr-mapfirst-impact-group dr-mapfirst-impact-adr">
                    <small>ADR</small>
                    <b>{adr}</b>
                  </span>
                </span>
              </span>
              <span className="dr-mapfirst-utility-row" aria-label="Held utility">
                {utility.map((item) => (
                  <span
                    key={item.kind}
                    className={[
                      "dr-mapfirst-utility-item",
                      item.active ? "dr-mapfirst-utility-item-active" : "",
                    ].filter(Boolean).join(" ")}
                    style={{ color: utilityColorCss(item.kind) }}
                    title={item.title}
                  >
                    <UtilityIcon className="dr-mapfirst-utility-icon" kind={item.kind} title={item.title} />
                    {item.count > 1 ? <span>{item.count}</span> : null}
                  </span>
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function buildRoundKillMap(round: Round, currentTick: number) {
  const kills = new Map<string, number>();

  for (const event of round.killEvents) {
    if (event.tick > currentTick || !event.killerPlayerId) {
      continue;
    }

    kills.set(event.killerPlayerId, (kills.get(event.killerPlayerId) ?? 0) + 1);
  }

  return kills;
}

function buildPlayerImpactMap(replay: Replay, activeRoundIndex: number, activeRound: Round, currentTick: number) {
  const impact = new Map<string, PlayerRoundImpact>();
  const roundsSeen = Math.max(1, activeRoundIndex + 1);

  for (let index = 0; index <= activeRoundIndex && index < replay.rounds.length; index += 1) {
    const round = replay.rounds[index];
    const tickCutoff = round === activeRound ? currentTick : Number.POSITIVE_INFINITY;

    for (const event of round.killEvents) {
      if (event.tick > tickCutoff) {
        continue;
      }

      if (event.killerPlayerId) {
        entryForPlayer(impact, event.killerPlayerId, roundsSeen).kills += 1;
      }

      if (event.assisterPlayerId) {
        entryForPlayer(impact, event.assisterPlayerId, roundsSeen).assists += 1;
      }

      entryForPlayer(impact, event.victimPlayerId, roundsSeen).deaths += 1;
    }

    for (const event of round.hurtEvents) {
      if (event.tick > tickCutoff || !event.attackerPlayerId || event.healthDamageTaken <= 0) {
        continue;
      }

      entryForPlayer(impact, event.attackerPlayerId, roundsSeen).damage += event.healthDamageTaken;
    }
  }

  return impact;
}

function entryForPlayer(impact: Map<string, PlayerRoundImpact>, playerId: string, roundsSeen: number) {
  const existing = impact.get(playerId);
  if (existing) {
    return existing;
  }

  const next = emptyImpact(roundsSeen);
  impact.set(playerId, next);
  return next;
}

function emptyImpact(roundsSeen: number): PlayerRoundImpact {
  return {
    assists: 0,
    damage: 0,
    deaths: 0,
    kills: 0,
    rounds: roundsSeen,
  };
}

function formatMoney(money: number | null) {
  if (money == null) {
    return "$-";
  }

  return `$${money.toLocaleString("en-US")}`;
}

function utilityInventory(player: LivePlayerState): RailIconItem[] {
  const activeUtilityKind = resolvePlayerEquipmentState({
    activeWeapon: player.activeWeapon,
    activeWeaponClass: player.activeWeaponClass,
    mainWeapon: player.mainWeapon,
  }).activeUtilityKind;
  const capacities: Array<{ count: number | null; kind: UtilityKind; label: string; slots: number; visualKind?: UtilityVisualKind }> = [
    { count: player.heGrenades, kind: "hegrenade", label: "HE grenade", slots: 1 },
    { count: player.flashbangs, kind: "flashbang", label: "Flashbang", slots: 2 },
    { count: player.smokes, kind: "smoke", label: "Smoke", slots: 1 },
    { count: player.fireGrenades, kind: "molotov", label: "Molotov / incendiary", slots: 1, visualKind: "fire" },
  ];

  return capacities
    .map((entry) => {
      const count = Math.min(entry.slots, Math.max(0, entry.count ?? 0));
      const kind = entry.visualKind ?? normalizeUtilityVisualKind(entry.kind) ?? "fire";

      return {
        active:
          (entry.kind === "molotov"
            ? activeUtilityKind === "molotov" || activeUtilityKind === "incendiary"
            : activeUtilityKind === entry.kind) && count > 0,
        count,
        kind,
        title: `${entry.label}${count > 1 ? ` x${count}` : ""}`,
      };
    })
    .filter((entry) => entry.count > 0);
}

function teamUtilitySummary(players: LivePlayerState[]) {
  const items: Array<{ count: number; kind: UtilityVisualKind; title: string }> = [
    { count: sumUtilityCount(players, "heGrenades"), kind: "hegrenade", title: "HE grenades" },
    { count: sumUtilityCount(players, "flashbangs"), kind: "flashbang", title: "Flashbangs" },
    { count: sumUtilityCount(players, "smokes"), kind: "smoke", title: "Smokes" },
    { count: sumUtilityCount(players, "fireGrenades"), kind: "fire", title: "Molotovs / incendiaries" },
  ];

  return {
    items,
    total: items.reduce((sum, item) => sum + item.count, 0),
  };
}

function sumUtilityCount(players: LivePlayerState[], field: "fireGrenades" | "flashbangs" | "heGrenades" | "smokes") {
  return players.reduce((sum, player) => sum + Math.max(0, player[field] ?? 0), 0);
}

function teamEquipmentValue(players: LivePlayerState[]) {
  return players.reduce((sum, player) => sum + playerEquipmentValue(player), 0);
}

function playerEquipmentValue(player: LivePlayerState) {
  if (!player.alive) {
    return 0;
  }

  const weaponNames = new Set<string>();
  addPricedWeapon(weaponNames, player.mainWeapon);

  if (
    player.activeWeaponClass !== "equipment" &&
    player.activeWeaponClass !== "knife" &&
    player.activeWeaponClass !== "utility"
  ) {
    addPricedWeapon(weaponNames, player.activeWeapon);
  }

  let value = 0;
  for (const weaponName of weaponNames) {
    value += weaponPrice(weaponName);
  }

  value += Math.max(0, player.heGrenades ?? 0) * 300;
  value += Math.max(0, player.flashbangs ?? 0) * 200;
  value += Math.max(0, player.smokes ?? 0) * 300;
  value += Math.max(0, player.fireGrenades ?? 0) * (player.side === "CT" ? 500 : 400);
  value += Math.max(0, player.decoys ?? 0) * 50;

  if (player.armor && player.armor > 0) {
    value += player.hasHelmet ? 1000 : 650;
  }

  return value;
}

function addPricedWeapon(weaponNames: Set<string>, weaponName: string | null) {
  const normalized = normalizeEquipmentName(weaponName);
  if (normalized) {
    weaponNames.add(normalized);
  }
}

function normalizeEquipmentName(weaponName: string | null) {
  if (!weaponName) {
    return null;
  }

  return weaponName
    .replace(/^weapon_/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function weaponPrice(normalizedWeaponName: string) {
  const prices: Record<string, number> = {
    ak47: 2700,
    aug: 3300,
    awp: 4750,
    bizon: 1400,
    cz75a: 500,
    deagle: 700,
    elite: 300,
    famas: 2050,
    fiveseven: 500,
    g3sg1: 5000,
    galilar: 1800,
    glock: 200,
    hkp2000: 200,
    m249: 5200,
    m4a1: 3100,
    m4a1silencer: 2900,
    mac10: 1050,
    mag7: 1300,
    mp5sd: 1500,
    mp7: 1500,
    mp9: 1250,
    negev: 1700,
    nova: 1050,
    p250: 300,
    p90: 2350,
    revolver: 600,
    sawedoff: 1100,
    scar20: 5000,
    sg556: 3000,
    ssg08: 1700,
    tec9: 500,
    ump45: 1200,
    uspsilencer: 200,
    xm1014: 2000,
  };

  return prices[normalizedWeaponName] ?? 0;
}
