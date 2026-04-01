import type { PositionsView } from "../replay/positionsAnalysis";
import type { ReplayAnalysisMode } from "../replay/replayAnalysis";

type Props = {
  analysisMode: ReplayAnalysisMode;
  positionsView: PositionsView;
  onSelectAnalysisMode: (mode: ReplayAnalysisMode) => void;
  onSelectPositionsView: (view: PositionsView) => void;
  onSelectShellPage: (page: "home" | "matches") => void;
};

export function Sidebar({
  analysisMode,
  positionsView,
  onSelectAnalysisMode,
  onSelectPositionsView,
  onSelectShellPage,
}: Props) {
  return (
    <aside className="sidebar replay-sidebar">
      <div className="replay-sidebar-layout">
        <section className="replay-rail-global">
          <button className="replay-rail-brand-button replay-rail-brand-button-global" onClick={() => onSelectShellPage("home")}>
            <span className="replay-rail-brand-mark">&gt;_</span>
            <strong>MM</strong>
          </button>

          <div className="replay-rail-global-nav">
            <button
              className="replay-rail-global-item"
              onClick={() => onSelectShellPage("home")}
              aria-label="Home"
              title="Home"
            >
              Home
            </button>
            <button
              className="replay-rail-global-item replay-rail-global-item-active"
              onClick={() => onSelectShellPage("matches")}
              aria-label="Matches"
              title="Matches"
            >
              Matches
            </button>
          </div>

          <section className="replay-rail-module replay-rail-module-nav">
            <span className="replay-rail-module-label">Analysis</span>
            <div className="replay-rail-column">
              <button
                className={analysisMode === "live" ? "replay-rail-nav-item replay-rail-nav-item-active" : "replay-rail-nav-item"}
                onClick={() => onSelectAnalysisMode("live")}
              >
                Live Replay
              </button>
              <button
                className={analysisMode === "utilityAtlas" ? "replay-rail-nav-item replay-rail-nav-item-active" : "replay-rail-nav-item"}
                onClick={() => onSelectAnalysisMode("utilityAtlas")}
              >
                Utility Atlas
              </button>
              <button
                className={
                  analysisMode === "positions" && positionsView === "paths"
                    ? "replay-rail-nav-item replay-rail-nav-item-active"
                    : "replay-rail-nav-item"
                }
                onClick={() => {
                  onSelectPositionsView("paths");
                  onSelectAnalysisMode("positions");
                }}
              >
                Position Paths
              </button>
              <button
                className={
                  analysisMode === "positions" && positionsView === "player"
                    ? "replay-rail-nav-item replay-rail-nav-item-active"
                    : "replay-rail-nav-item"
                }
                onClick={() => {
                  onSelectPositionsView("player");
                  onSelectAnalysisMode("positions");
                }}
              >
                Position Player
              </button>
              <button
                className={analysisMode === "heatmap" ? "replay-rail-nav-item replay-rail-nav-item-active" : "replay-rail-nav-item"}
                onClick={() => onSelectAnalysisMode("heatmap")}
              >
                Heatmap
              </button>
            </div>
          </section>
        </section>
      </div>
    </aside>
  );
}
