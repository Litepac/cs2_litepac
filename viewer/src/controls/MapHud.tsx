import type { UtilityFocus } from "../replay/utilityFilter";
import { roundLiveState } from "../replay/live";
import type { Replay, Round } from "../replay/types";

type Props = {
  currentTick: number;
  replay: Replay;
  round: Round;
  selectedPlayerId: string | null;
  utilityFocus: UtilityFocus;
};

export function MapHud({ currentTick, replay, round, selectedPlayerId, utilityFocus }: Props) {
  const live = roundLiveState(replay, round, currentTick, selectedPlayerId, utilityFocus);

  return (
    <div className="map-hud">
      <div className="hud-cluster hud-cluster-bottom-right">
        <div className="hud-card">
          <div className="hud-label">Utility</div>
          <strong>{live.activeUtilityCount}</strong>
          <span>Active entities</span>
        </div>
      </div>
    </div>
  );
}
