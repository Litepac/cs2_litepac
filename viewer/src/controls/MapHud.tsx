import { scoreForSide, sideTeam } from "../replay/derived";
import { livePlayersAtTick } from "../replay/live";
import { resolveRoundTimer } from "../replay/roundTimer";
import type { Replay, Round } from "../replay/types";

type Props = {
  currentTick: number;
  replay: Replay;
  round: Round;
};

export function MapHud({ currentTick, replay, round }: Props) {
  const players = livePlayersAtTick(replay, round, currentTick);
  const ctAlive = players.filter((entry) => entry.side === "CT" && entry.alive).length;
  const tAlive = players.filter((entry) => entry.side === "T" && entry.alive).length;
  const timer = resolveRoundTimer(replay, round, currentTick);
  const ctTeam = sideTeam(replay, round, "CT");
  const tTeam = sideTeam(replay, round, "T");

  return (
    <div className="map-hud">
      <div className={`map-hud-strip${timer ? "" : " map-hud-strip-no-timer"}`}>
        <div className="map-hud-side map-hud-side-ct">
          <div className="map-hud-side-main">
            <strong className="map-hud-side-team">{ctTeam?.displayName ?? "CT"}</strong>
          </div>
          <span className="map-hud-side-alive">{ctAlive} alive</span>
        </div>

        {timer ? (
          <div className={`map-hud-timer map-hud-timer-${timer.phase}`}>
            <span>{timer.label}</span>
            <strong>{timer.display}</strong>
            <div className="map-hud-scoreline">
              <b className="map-hud-scoreline-ct">{scoreForSide(round, "CT", "before")}</b>
              <span>-</span>
              <b className="map-hud-scoreline-t">{scoreForSide(round, "T", "before")}</b>
            </div>
          </div>
        ) : null}

        <div className="map-hud-side map-hud-side-t">
          <div className="map-hud-side-main">
            <strong className="map-hud-side-team">{tTeam?.displayName ?? "T"}</strong>
          </div>
          <span className="map-hud-side-alive">{tAlive} alive</span>
        </div>
      </div>
    </div>
  );
}
