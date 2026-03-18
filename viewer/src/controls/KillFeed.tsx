import type { Replay, Round } from "../replay/types";

type Props = {
  replay: Replay;
  round: Round;
  currentTick: number;
};

const MAX_ITEMS = 4;
const KILL_FEED_WINDOW_TICKS = 64 * 12;

export function KillFeed({ replay, round, currentTick }: Props) {
  const items = round.killEvents
    .filter((event) => event.tick <= currentTick && currentTick - event.tick <= KILL_FEED_WINDOW_TICKS)
    .slice(-MAX_ITEMS)
    .reverse()
    .map((event) => {
      const killer = event.killerPlayerId ? replay.players.find((player) => player.playerId === event.killerPlayerId) : null;
      const assister = event.assisterPlayerId ? replay.players.find((player) => player.playerId === event.assisterPlayerId) : null;
      const victim = replay.players.find((player) => player.playerId === event.victimPlayerId) ?? null;

      return {
        assisterName: assister?.displayName ?? null,
        key: `${event.tick}-${event.victimPlayerId}-${event.weaponName}`,
        killerName: killer?.displayName ?? "World",
        side: killer?.teamId === victim?.teamId ? null : sideForPlayer(replay, round, killer?.playerId ?? null),
        victimName: victim?.displayName ?? "Unknown",
        weaponName: compactWeaponName(event.weaponName),
      };
    });

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="killfeed">
      {items.map((item) => (
        <div key={item.key} className="killfeed-item">
          <span className={item.side === "CT" ? "killfeed-name killfeed-name-ct" : item.side === "T" ? "killfeed-name killfeed-name-t" : "killfeed-name"}>
            {item.killerName}
          </span>
          {item.assisterName ? <span className="killfeed-assist">+ {item.assisterName}</span> : null}
          <span className="killfeed-weapon">{item.weaponName}</span>
          <span className="killfeed-name killfeed-name-victim">{item.victimName}</span>
        </div>
      ))}
    </div>
  );
}

function sideForPlayer(replay: Replay, round: Round, playerId: string | null) {
  if (!playerId) {
    return null;
  }

  const stream = round.playerStreams.find((entry) => entry.playerId === playerId);
  return stream?.side ?? null;
}

function compactWeaponName(weaponName: string) {
  const normalized = weaponName.trim();
  if (!normalized) {
    return "KILL";
  }

  return normalized
    .replace("weapon_", "")
    .replaceAll("_", " ")
    .toUpperCase();
}
