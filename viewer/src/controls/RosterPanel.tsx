import { scoreForSide, sideTeam } from "../replay/derived";
import { livePlayersAtTick, type LivePlayerState } from "../replay/live";
import type { Replay, Round } from "../replay/types";

type Props = {
  replay: Replay;
  round: Round;
  currentTick: number;
  selectedPlayerId: string | null;
  onSelectPlayer: (playerId: string) => void;
};

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
        {players.map((player) => (
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
                  <span className="roster-player-weapon">{displayWeaponName(player.mainWeapon ?? player.activeWeapon)}</span>
                </span>
                <span className="roster-player-support-row">
                  <span className="roster-player-economy">{formatMoney(player.money)}</span>
                  <span className="roster-player-meta-row">
                    <span className="roster-utility-row">
                      {utilityIcons(player).map((icon, index) => (
                        <span
                          key={`${icon.kind}-${index}`}
                          className={`roster-utility-icon roster-utility-icon-${icon.kind}`}
                          title={icon.title}
                        >
                          {icon.glyph}
                        </span>
                      ))}
                    </span>
                    <span className="roster-player-vitals-inline">
                      <span className="roster-player-mini-stat">{formatHealth(player)}</span>
                      <span className="roster-player-mini-stat">{formatArmor(player)}</span>
                    </span>
                    {player.hasBomb ? <span className="roster-player-mini-stat roster-player-mini-stat-bomb">BOMB</span> : null}
                  </span>
                </span>
                <span className="roster-health-track" aria-hidden="true">
                  <span
                    className={`roster-health-fill ${sideClass}`}
                    style={{ width: `${healthWidth(player)}%` }}
                />
              </span>
              <span className={`roster-player-rule ${sideClass}`} />
            </span>
          </button>
        ))}
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

function formatHealth(player: LivePlayerState) {
  if (player.health == null) {
    return "HP-";
  }

  return `${Math.max(0, player.health)}HP`;
}

function formatArmor(player: LivePlayerState) {
  if (player.armor == null) {
    return player.hasHelmet ? "AR- H" : "AR-";
  }

  return player.hasHelmet ? `${player.armor}AR H` : `${player.armor}AR`;
}

function healthWidth(player: LivePlayerState) {
  if (player.health == null) {
    return 0;
  }

  return Math.min(100, Math.max(0, player.health));
}

function displayWeaponName(weaponName: string | null) {
  if (!weaponName) {
    return "--";
  }

  const normalized = weaponName
    .replace("weapon_", "")
    .replaceAll("_", " ")
    .trim()
    .toUpperCase();

  const aliases: Record<string, string> = {
    "M4A1 SILENCER": "M4A1-S",
    "USP SILENCER": "USP-S",
    "GLOCK": "GLOCK-18",
    "MAG 7": "MAG-7",
    "MP9": "MP9",
    "MP7": "MP7",
    "AK47": "AK-47",
    "GALIL AR": "GALIL AR",
    "FAMAS": "FAMAS",
    "MAC10": "MAC-10",
    "P250": "P250",
    "DEAGLE": "DEAGLE",
    "AWP": "AWP",
    "FIVESEVEN": "FIVE-SEVEN",
  };

  return aliases[normalized] ?? normalized;
}

function utilityIcons(player: LivePlayerState) {
  return [
    ...repeatUtilityIcon("flashbang", player.flashbangs, "FB", "Flashbang"),
    ...repeatUtilityIcon("smoke", player.smokes, "SM", "Smoke"),
    ...repeatUtilityIcon("hegrenade", player.heGrenades, "HE", "HE grenade"),
    ...repeatUtilityIcon("fire", player.fireGrenades, "MO", "Molotov / incendiary"),
    ...repeatUtilityIcon("decoy", player.decoys, "DE", "Decoy"),
  ];
}

function repeatUtilityIcon(kind: string, value: number | null, glyph: string, title: string) {
  if (value == null || value <= 0) {
    return [];
  }

  return Array.from({ length: value }, () => ({
    glyph,
    kind,
    title,
  }));
}
