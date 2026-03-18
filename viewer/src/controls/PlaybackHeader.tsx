import { sideTeam, scoreForSide, type Side } from "../replay/derived";
import type { Replay, Round } from "../replay/types";

type Props = {
  replay: Replay;
  round: Round;
};

export function PlaybackHeader({ replay, round }: Props) {
  const ctTeam = sideTeam(replay, round, "CT");
  const tTeam = sideTeam(replay, round, "T");

  return (
    <header className="playback-header">
      <div className="header-block header-meta header-meta-compact">
        <div className="header-meta-line">
          <span className="meta-chip">{replay.map.displayName}</span>
          <span className="meta-chip meta-chip-muted">{replay.sourceDemo.fileName}</span>
          <span className="meta-chip meta-chip-muted">Round {round.roundNumber}</span>
          {round.winnerSide ? <span className={`meta-chip meta-chip-${round.winnerSide.toLowerCase()}`}>Winner {round.winnerSide}</span> : null}
        </div>
      </div>

      <div className="header-block header-scoreboard">
        <TeamScoreCard replay={replay} round={round} side="CT" label={ctTeam?.displayName ?? "CT Side"} />
        <TeamScoreCard replay={replay} round={round} side="T" label={tTeam?.displayName ?? "T Side"} />
      </div>
    </header>
  );
}

type TeamScoreProps = {
  replay: Replay;
  round: Round;
  side: Side;
  label: string;
};

function TeamScoreCard({ replay, round, side, label }: TeamScoreProps) {
  const winner = round.winnerSide === side;
  const current = scoreForSide(round, side, "before");
  const final = scoreForSide(round, side, "after");
  const sideLabel = side === "CT" ? "CT" : "T";
  const accentClass = side === "CT" ? "team-score-ct" : "team-score-t";

  return (
    <div className={`team-score ${accentClass} ${winner ? "team-score-winner" : ""}`}>
      <div className="team-score-side">{sideLabel}</div>
      <div className="team-score-copy">
        <span>{label}</span>
        <small>{replay.map.displayName}</small>
      </div>
      <div className="team-score-values">
        <strong>{current}</strong>
        <small>final {final}</small>
      </div>
    </div>
  );
}
