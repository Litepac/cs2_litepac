import type { MatchLibraryEntry } from "../replay/matchLibrary";

type Props = {
  latestMatch: MatchLibraryEntry | null;
  localMatchCount: number;
  parserBridgeAvailable: boolean;
  onOpenMatches: () => void;
};

const foundationPoints = ["Parser First", "Map First", "Trust First"];

export function HomePage({ latestMatch, localMatchCount, parserBridgeAvailable, onOpenMatches }: Props) {
  return (
    <section className="home-page">
      <div className="home-cyber-shell">
        <div className="home-cyber-grid" />
        <div className="home-cyber-scanlines" />

        <div className="home-hero-shell home-hero-shell-cyber">
          <div className="home-hero home-hero-cyber">
            <div className="home-status-chip">
              <span>Replay Workspace</span>
            </div>
            <h2 className="home-display-headline">
              <span className="home-display-line home-display-line-primary">READ</span>
              <span className="home-display-line home-display-line-accent">THE ROUND</span>
              <span className="home-display-line home-display-line-secondary">RIGHT</span>
            </h2>
            <div className="home-terminal-copy">
              <span className="home-terminal-prefix">&gt;</span>
              <p>
                Turn local CS2 demos into canonical replay truth, then step into a 2D review surface built for round
                reads, utility, and bomb context.
              </p>
            </div>
            <div className="home-hero-actions home-hero-actions-cyber">
              <button className="home-primary-button home-primary-button-cyber" onClick={onOpenMatches}>Open Matches</button>
              <span className={`home-bridge-status home-bridge-status-cyber ${parserBridgeAvailable ? "home-bridge-status-live" : ""}`}>
                {parserBridgeAvailable ? "Parser Bridge Online" : "Parser Bridge Offline"}
              </span>
            </div>
            <div className="home-principles-inline">
              {foundationPoints.map((point) => (
                <span key={point}>{point}</span>
              ))}
            </div>
          </div>

          <aside className="home-product-frame home-product-frame-cyber">
            <div className="home-product-frame-header">
              <span>HUD Display v0.1</span>
              <small>Local Review Surface</small>
            </div>

            <div className="home-product-screen">
              <div className="home-product-stage">
                <div
                  className={`home-product-stage-map ${latestMatch ? "" : "home-product-stage-map-empty"}`}
                  style={
                    latestMatch
                      ? {
                          backgroundImage: `linear-gradient(180deg, rgba(4, 8, 12, 0.12), rgba(4, 8, 12, 0.72)), url(${latestMatch.summary.mapImageUrl})`,
                        }
                      : undefined
                  }
                />
                <div className="home-product-stage-overlay">
                  <div className="home-product-stage-tag">Canonical replay locked</div>
                  {latestMatch ? (
                    <div className="home-product-stage-summary">
                      <span>Latest Local Match</span>
                      <strong>{latestMatch.summary.mapName}</strong>
                      <small>{latestMatch.summary.teamAName} vs {latestMatch.summary.teamBName}</small>
                    </div>
                  ) : (
                    <div className="home-product-stage-summary">
                      <span>Awaiting first upload</span>
                      <strong>Parser-first ingest</strong>
                      <small>Your first demo will light up this product preview.</small>
                    </div>
                  )}
                </div>
                <div className="home-product-stage-hud">
                  <div className="home-product-stage-hud-card">
                    <span>Bridge</span>
                    <strong>{parserBridgeAvailable ? "ONLINE" : "OFFLINE"}</strong>
                  </div>
                  <div className="home-product-stage-hud-card home-product-stage-hud-card-accent">
                    <span>Library</span>
                    <strong>{localMatchCount}</strong>
                  </div>
                </div>
                <div className="home-product-stage-dock">
                  <div className="home-product-stage-dock-line" />
                  <div className="home-product-stage-dock-points">
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>

              <div className="home-product-flow">
                <div className="home-product-flow-row">
                  <span>01</span>
                  <p>Upload `.dem` locally through the parser bridge.</p>
                </div>
                <div className="home-product-flow-row">
                  <span>02</span>
                  <p>Index the match by map, teams, score, and added date.</p>
                </div>
                <div className="home-product-flow-row">
                  <span>03</span>
                  <p>Open the replay workspace only after canonical truth is ready.</p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
