type ReplayHudProps = {
  ctAlive: number;
  ctScore: number;
  ctTeamName: string;
  ctTotal: number;
  mapName: string;
  modeLabel: string;
  roundNumber: number;
  tAlive: number;
  tScore: number;
  tTeamName: string;
  tTotal: number;
  timerDisplay: string;
};

export function ReplayHud({
  ctAlive,
  ctScore,
  ctTeamName,
  ctTotal,
  mapName,
  modeLabel,
  roundNumber,
  tAlive,
  tScore,
  tTeamName,
  tTotal,
  timerDisplay,
}: ReplayHudProps) {
  return (
    <header className="dr-mapfirst-hud" aria-label="Replay status">
      <div className="dr-mapfirst-hud-team dr-mapfirst-hud-team-ct">
        <strong>{ctTeamName}</strong>
        <small>{ctAlive} / {ctTotal} alive</small>
      </div>
      <div className="dr-mapfirst-hud-center">
        <span>{mapName} / Round {roundNumber}</span>
        <b>{timerDisplay}</b>
        <strong>
          <span className="dr-mapfirst-hud-score-ct">{ctScore}</span>
          <i>-</i>
          <span className="dr-mapfirst-hud-score-t">{tScore}</span>
        </strong>
        <small>{modeLabel}</small>
      </div>
      <div className="dr-mapfirst-hud-team dr-mapfirst-hud-team-t">
        <strong>{tTeamName}</strong>
        <small>{tAlive} / {tTotal} alive</small>
      </div>
    </header>
  );
}
