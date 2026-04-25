type ReplayHudProps = {
  ctScore: number;
  ctTeamName: string;
  mapName: string;
  modeLabel: string;
  roundNumber: number;
  tScore: number;
  tTeamName: string;
  timerDisplay: string;
};

export function ReplayHud({
  ctScore,
  ctTeamName,
  mapName,
  modeLabel,
  roundNumber,
  tScore,
  tTeamName,
  timerDisplay,
}: ReplayHudProps) {
  return (
    <header className="dr-mapfirst-hud" aria-label="Replay status">
      <div className="dr-mapfirst-hud-team dr-mapfirst-hud-team-ct">
        <strong>{ctTeamName}</strong>
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
      </div>
    </header>
  );
}
