import type { Side } from "../../replay/derived";
import type { LivePlayerState } from "../../replay/live";
import { normalizeUtilityVisualKind, utilityColorCss, type UtilityVisualKind } from "../../replay/utilityPresentation";
import { formatWeaponLabel, resolvePlayerEquipmentState, type UtilityKind } from "../../replay/weapons";
import { EquipmentIcon } from "../EquipmentIcon";
import { UtilityIcon } from "../UtilityIcon";
import { WeaponGlyph } from "../WeaponGlyph";

type ReplayRosterColumnProps = {
  players: LivePlayerState[];
  selectedPlayerId: string | null;
  side: Side;
  teamLabel: string;
  onSelectPlayer: (playerId: string) => void;
};

type RailIconItem = {
  active: boolean;
  count: number;
  kind: UtilityVisualKind;
  title: string;
};

export function ReplayRosterColumn({ players, selectedPlayerId, side, teamLabel, onSelectPlayer }: ReplayRosterColumnProps) {
  return (
    <section className={`dr-mapfirst-roster-column dr-mapfirst-roster-column-${side.toLowerCase()}`} aria-label={`${teamLabel} roster`}>
      <header className="dr-mapfirst-roster-header">
        <div>
          <span>{side}</span>
          <strong>{teamLabel}</strong>
        </div>
        <small>{players.filter((entry) => entry.alive).length} / {players.length}</small>
      </header>
      <div className="dr-mapfirst-roster-list">
        {players.map((player) => {
          const equipment = resolvePlayerEquipmentState({
            activeWeapon: player.activeWeapon,
            activeWeaponClass: player.activeWeaponClass,
            mainWeapon: player.mainWeapon,
          });
          const utility = utilityInventory(player);
          const weaponSlots = playerWeaponSlots(equipment.primaryWeapon, equipment.currentWeapon);

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
              type="button"
            >
              <span className="dr-mapfirst-player-main">
                <span className="dr-mapfirst-player-name">{player.name}</span>
                <span className="dr-mapfirst-player-money">{formatMoney(player.money)}</span>
              </span>
              <span className="dr-mapfirst-player-loadout">
                {weaponSlots.map((slot) => (
                  <span key={`${slot.type}:${slot.weaponName ?? "unknown"}`} className={`dr-mapfirst-weapon-slot dr-mapfirst-weapon-slot-${slot.type}`}>
                    <WeaponGlyph className="dr-mapfirst-weapon-glyph" title={slot.label} weaponName={slot.weaponName} />
                    <span>{slot.label}</span>
                  </span>
                ))}
              </span>
              <span className="dr-mapfirst-player-meta">
                <span>{player.health == null ? "--" : Math.max(0, player.health)} HP</span>
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

function formatMoney(money: number | null) {
  if (money == null) {
    return "$-";
  }

  return `$${money.toLocaleString("en-US")}`;
}

function playerWeaponSlots(primaryWeapon: string | null, currentWeapon: string | null) {
  const slots = [];
  if (primaryWeapon) {
    slots.push({
      label: formatWeaponLabel(primaryWeapon),
      type: "primary",
      weaponName: primaryWeapon,
    });
  }

  if (currentWeapon && currentWeapon !== primaryWeapon) {
    slots.push({
      label: formatWeaponLabel(currentWeapon),
      type: "active",
      weaponName: currentWeapon,
    });
  }

  if (slots.length === 0) {
    slots.push({
      label: "--",
      type: "unknown",
      weaponName: null,
    });
  }

  return slots;
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
