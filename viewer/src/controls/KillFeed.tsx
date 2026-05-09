import type { Replay, Round } from "../replay/types";
import blindKillIcon from "../assets/icons/cs2-deathnotice/panorama/images/hud/deathnotice/blind_kill.svg";
import headshotIcon from "../assets/icons/cs2-deathnotice/panorama/images/hud/deathnotice/icon_headshot.svg";
import noScopeIcon from "../assets/icons/cs2-deathnotice/panorama/images/hud/deathnotice/noscope.svg";
import penetrateIcon from "../assets/icons/cs2-deathnotice/panorama/images/hud/deathnotice/penetrate.svg";
import smokeKillIcon from "../assets/icons/cs2-deathnotice/panorama/images/hud/deathnotice/smoke_kill.svg";
import flashAssistIcon from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/flashbang_assist.svg";
import { formatWeaponLabel } from "../replay/weapons";
import { WeaponGlyph } from "./WeaponGlyph";

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
        assistedFlash: event.assistedFlash === true,
        attackerBlind: event.attackerBlind === true,
        headshot: event.isHeadshot,
        key: `${event.tick}-${event.victimPlayerId}-${event.weaponName}`,
        killerName: killer?.displayName ?? "World",
        killerSide: killer?.teamId === victim?.teamId ? null : sideForPlayer(round, killer?.playerId ?? null),
        noScope: event.noScope === true,
        penetratedObjects: event.penetratedObjects ?? 0,
        throughSmoke: event.throughSmoke === true,
        victimSide: sideForPlayer(round, victim?.playerId ?? null),
        victimName: victim?.displayName ?? "Unknown",
        weaponLabel: formatWeaponLabel(event.weaponName),
        weaponName: event.weaponName,
      };
    });

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="killfeed">
      {items.map((item) => (
        <div key={item.key} className="killfeed-item">
          <span className={nameClass(item.killerSide)}>
            {item.killerName}
          </span>
          {item.assisterName ? <span className="killfeed-assist">+ {item.assisterName}</span> : null}
          {item.assistedFlash ? <KillFeedModifierIcon kind="flashAssist" title="Flash assist" /> : null}
          {item.attackerBlind ? <KillFeedModifierIcon kind="attackerBlind" title="Blind kill" /> : null}
          {item.noScope ? <KillFeedModifierIcon kind="noScope" title="No-scope" /> : null}
          {item.throughSmoke ? <KillFeedModifierIcon kind="throughSmoke" title="Kill through smoke" /> : null}
          {item.penetratedObjects > 0 ? (
            <KillFeedModifierIcon kind="wallbang" title={`${item.penetratedObjects} penetrated object${item.penetratedObjects === 1 ? "" : "s"}`} />
          ) : null}
          {item.headshot ? <KillFeedModifierIcon kind="headshot" title="Headshot" /> : null}
          <span className="killfeed-weapon" title={item.weaponLabel}>
            <WeaponGlyph className="killfeed-weapon-icon" weaponName={item.weaponName} />
            <span>{item.weaponLabel}</span>
          </span>
          <span className={nameClass(item.victimSide, "killfeed-name-victim")}>{item.victimName}</span>
        </div>
      ))}
    </div>
  );
}

function KillFeedModifierIcon({
  kind,
  title,
}: {
  kind: "attackerBlind" | "flashAssist" | "headshot" | "noScope" | "throughSmoke" | "wallbang";
  title: string;
}) {
  const icon = modifierIcons[kind];

  return (
    <span aria-label={title} className={`killfeed-mod killfeed-mod-img killfeed-mod-${kind}`} title={title}>
      <img alt="" aria-hidden="true" src={icon} />
    </span>
  );
}

const modifierIcons = {
  attackerBlind: blindKillIcon,
  flashAssist: flashAssistIcon,
  headshot: headshotIcon,
  noScope: noScopeIcon,
  throughSmoke: smokeKillIcon,
  wallbang: penetrateIcon,
};

function nameClass(side: "CT" | "T" | null, extraClass?: string) {
  const classes = ["killfeed-name"];
  if (side === "CT") {
    classes.push("killfeed-name-ct");
  } else if (side === "T") {
    classes.push("killfeed-name-t");
  }
  if (extraClass) {
    classes.push(extraClass);
  }
  return classes.join(" ");
}

function sideForPlayer(round: Round, playerId: string | null) {
  if (!playerId) {
    return null;
  }

  const stream = round.playerStreams.find((entry) => entry.playerId === playerId);
  return stream?.side ?? null;
}
