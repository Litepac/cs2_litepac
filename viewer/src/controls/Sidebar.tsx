import type { MatchLibraryEntry } from "../replay/matchLibrary";
import type { Replay } from "../replay/types";

type Props = {
  activeReplayId: string | null;
  error: string | null;
  loadingSource: "demo" | "fixture" | "replay" | null;
  matches: MatchLibraryEntry[];
  onSelectShellPage: (page: "home" | "matches") => void;
  onCloseReplay: () => void;
  onOpenMatch: (id: string) => void;
  replay: Replay | null;
  shellPage: "home" | "matches";
};

export function Sidebar({
  activeReplayId,
  error,
  loadingSource,
  matches,
  onSelectShellPage,
  onCloseReplay,
  onOpenMatch,
  replay,
  shellPage,
}: Props) {
  return (
    <aside className="sidebar">
      <div className="brand-card">
        <div className="eyebrow">Replay Core</div>
        <h1>Mastermind</h1>
      </div>

      <section className="sidebar-card">
        <div className="card-title">Navigate</div>
        <div className="shell-nav-list">
          <button
            className={`shell-nav-item ${shellPage === "home" && !replay ? "shell-nav-item-active" : ""}`}
            onClick={() => onSelectShellPage("home")}
          >
            <span>Home</span>
            <small>Welcome</small>
          </button>
          <button
            className={`shell-nav-item ${shellPage === "matches" && !replay ? "shell-nav-item-active" : ""}`}
            onClick={() => onSelectShellPage("matches")}
          >
            <span>Matches</span>
            <small>{matches.length} local</small>
          </button>
          {replay ? (
            <button className="shell-nav-item shell-nav-item-replay" onClick={onCloseReplay}>
              <span>Replay View</span>
              <small>Back to matches</small>
            </button>
          ) : null}
        </div>
      </section>

      {loadingSource ? <section className="sidebar-card"><div className="source-status">Loading {loadingSource === "demo" ? "demo" : loadingSource}...</div></section> : null}
      {error ? <section className="sidebar-card"><pre className="error-box">{error}</pre></section> : null}

      {replay ? (
        <section className="sidebar-card">
          <div className="card-title">Replay Meta</div>
          <dl className="meta-grid">
            <div className="meta-pair">
              <dt>Mode</dt>
              <dd>Replay View</dd>
            </div>
            <div className="meta-pair">
              <dt>Map</dt>
              <dd>{replay.map.displayName}</dd>
            </div>
            <div className="meta-pair">
              <dt>Rounds</dt>
              <dd>{replay.match.totalRounds}</dd>
            </div>
            <div className="meta-pair">
              <dt>Tick Rate</dt>
              <dd>{replay.match.tickRate.toFixed(2)}</dd>
            </div>
          </dl>
          <button className="sidebar-link-button" onClick={onCloseReplay}>Back To Matches</button>
        </section>
      ) : null}

      {matches.length > 0 ? (
        <section className="sidebar-card">
          <div className="card-title">Recent Matches</div>
          <div className="fixture-list">
            {matches.slice(0, 5).map((entry) => (
              <button
                key={entry.id}
                className={`fixture-item ${activeReplayId === entry.id ? "fixture-item-active" : ""}`}
                onClick={() => onOpenMatch(entry.id)}
                disabled={loadingSource != null}
              >
                <span className="fixture-copy">
                  <strong>{entry.summary.mapName}</strong>
                  <small>{entry.summary.teamAName} vs {entry.summary.teamBName}</small>
                </span>
                <strong>{entry.summary.teamAScore}-{entry.summary.teamBScore}</strong>
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </aside>
  );
}
