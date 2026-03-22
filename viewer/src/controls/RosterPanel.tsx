import { scoreForSide, sideTeam } from "../replay/derived";
import { livePlayersAtTick, type LivePlayerState } from "../replay/live";
import { normalizeUtilityVisualKind, utilityColorCss, type UtilityVisualKind } from "../replay/utilityPresentation";
import type { Replay, Round } from "../replay/types";
import { formatWeaponLabel, resolvePlayerEquipmentState, type UtilityKind } from "../replay/weapons";
import { UtilityIcon } from "./UtilityIcon";

type Props = {
  replay: Replay;
  round: Round;
  currentTick: number;
  selectedPlayerId: string | null;
  onSelectPlayer: (playerId: string) => void;
};

type RailIconKind = UtilityVisualKind;

export function RosterPanel({ replay, round, currentTick, selectedPlayerId, onSelectPlayer }: Props) {
  const snapshots = livePlayersAtTick(replay, round, currentTick);
  const ctPlayers = snapshots.filter((entry) => entry.side === "CT");
  const tPlayers = snapshots.filter((entry) => entry.side === "T");

  return (
    <aside className="roster-panel">
      <RosterSection
        aliveCount={ctPlayers.filter((entry) => entry.alive).length}
        currentScore={scoreForSide(round, "CT", "before")}
        finalScore={scoreForSide(round, "CT", "after")}
        players={ctPlayers}
        selectedPlayerId={selectedPlayerId}
        side="CT"
        teamLabel={sideTeam(replay, round, "CT")?.displayName ?? "CT Side"}
        onSelectPlayer={onSelectPlayer}
      />
      <RosterSection
        aliveCount={tPlayers.filter((entry) => entry.alive).length}
        currentScore={scoreForSide(round, "T", "before")}
        finalScore={scoreForSide(round, "T", "after")}
        players={tPlayers}
        selectedPlayerId={selectedPlayerId}
        side="T"
        teamLabel={sideTeam(replay, round, "T")?.displayName ?? "T Side"}
        onSelectPlayer={onSelectPlayer}
      />
    </aside>
  );
}

type SectionProps = {
  aliveCount: number;
  currentScore: number;
  finalScore: number;
  players: ReturnType<typeof livePlayersAtTick>;
  selectedPlayerId: string | null;
  side: "T" | "CT";
  teamLabel: string;
  onSelectPlayer: (playerId: string) => void;
};

type RailIconItem = {
  active: boolean;
  count: number;
  kind: RailIconKind;
  title: string;
};

function RosterSection({
  aliveCount,
  currentScore,
  finalScore,
  players,
  selectedPlayerId,
  side,
  teamLabel,
  onSelectPlayer,
}: SectionProps) {
  const sideClass = side === "CT" ? "side-ct" : "side-t";
  const aliveLabel = `${aliveCount}/${players.length} alive`;

  return (
    <section className={`roster-card ${sideClass}`}>
      <div className="roster-card-header">
        <div className="roster-team-block">
          <div className="roster-side-label">{side}</div>
          <h2>{teamLabel}</h2>
          <div className="roster-score-caption">{aliveLabel}</div>
        </div>
        <div className="roster-score-block">
          <strong>{currentScore}</strong>
          <span>final {finalScore}</span>
        </div>
      </div>

      <div className="roster-list">
        {players.map((player) => {
          const heldUtility = railIcons(player);
          const equipment = resolvePlayerEquipmentState({
            activeWeapon: player.activeWeapon,
            activeWeaponClass: player.activeWeaponClass,
            mainWeapon: player.mainWeapon,
          });
          return (
            <button
              key={player.playerId}
              className={[
                "roster-item",
                player.playerId === selectedPlayerId ? "roster-item-active" : "",
                player.alive ? "" : "roster-item-dead",
              ].filter(Boolean).join(" ")}
              onClick={() => onSelectPlayer(player.playerId)}
            >
              <span className="roster-player-main">
                <span className="roster-player-header">
                  <span className="roster-player-name">{player.name}</span>
                  <span className="roster-player-weapon">{formatWeaponLabel(equipment.displayWeapon)}</span>
                </span>
                <span className="roster-player-support-row">
                  <span className="roster-player-meta">
                    <span className="roster-player-mini-stat">{formatSupportMeta(player)}</span>
                  </span>
                  <span className="roster-utility-strip" aria-label="Held utility">
                    {heldUtility.length > 0 ? (
                      heldUtility.map((item) => (
                        <span
                          key={item.kind}
                          className={[
                            "roster-utility-item",
                            item.active ? "roster-utility-item-active" : "",
                          ].filter(Boolean).join(" ")}
                          title={item.title}
                          style={{ color: utilityColorCss(item.kind) }}
                        >
                          <UtilityIcon className="roster-utility-shape" kind={item.kind} title={item.title} />
                          {item.count > 1 ? <span className="roster-utility-count">{item.count}</span> : null}
                        </span>
                      ))
                    ) : null}
                  </span>
                </span>
                <span className="roster-health-track" aria-hidden="true">
                  <span
                    className={`roster-health-fill ${sideClass}`}
                    style={{ width: `${healthWidth(player)}%` }}
                  />
                </span>
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

function formatVitals(player: LivePlayerState) {
  const health = player.health == null ? "HP-" : `${Math.max(0, player.health)}HP`;
  const armor = player.armor == null ? "AR-" : `${player.armor}AR`;
  return player.hasHelmet ? `${health} ${armor} H` : `${health} ${armor}`;
}

function formatSupportMeta(player: LivePlayerState) {
  return `${formatMoney(player.money)} ${formatVitals(player)}`;
}

function healthWidth(player: LivePlayerState) {
  if (player.health == null) {
    return 0;
  }

  return Math.min(100, Math.max(0, player.health));
}

function utilityInventory(player: LivePlayerState): RailIconItem[] {
  const activeUtilityKind = resolvePlayerEquipmentState({
    activeWeapon: player.activeWeapon,
    activeWeaponClass: player.activeWeaponClass,
    mainWeapon: player.mainWeapon,
  }).activeUtilityKind;
  const capacities: Array<{ count: number | null; kind: UtilityKind; label: string; slots: number }> = [
    { count: player.flashbangs, kind: "flashbang", label: "Flashbang", slots: 2 },
    { count: player.smokes, kind: "smoke", label: "Smoke", slots: 1 },
    { count: player.heGrenades, kind: "hegrenade", label: "HE grenade", slots: 1 },
    { count: player.fireGrenades, kind: "molotov", label: "Molotov / incendiary", slots: 1 },
    { count: player.decoys, kind: "decoy", label: "Decoy", slots: 1 },
  ];

  return capacities
    .map((entry) => ({
      active:
        (entry.kind === "molotov"
          ? activeUtilityKind === "molotov" || activeUtilityKind === "incendiary"
          : activeUtilityKind === entry.kind) && (entry.count ?? 0) > 0,
      count: Math.min(entry.slots, Math.max(0, entry.count ?? 0)),
      kind: normalizeUtilityVisualKind(entry.kind) ?? "fire",
      title: `${entry.label}${(entry.count ?? 0) > 1 ? ` x${Math.min(entry.slots, Math.max(0, entry.count ?? 0))}` : ""}`,
    }))
    .filter((entry) => entry.count > 0)
    .sort((left, right) => {
      if (left.active !== right.active) {
        return left.active ? -1 : 1;
      }

      return 0;
    });
}

function railIcons(player: LivePlayerState): RailIconItem[] {
  const utility = utilityInventory(player);
  if (!player.hasBomb) {
    return utility;
  }

  return [
    ...utility,
    {
      active: false,
      count: 0,
      kind: "bomb",
      title: "Bomb",
    },
  ];
}
