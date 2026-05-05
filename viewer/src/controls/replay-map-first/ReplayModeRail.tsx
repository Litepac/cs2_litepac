import type { PositionsView } from "../../replay/positionsAnalysis";
import type { ReplayAnalysisMode } from "../../replay/replayAnalysis";

type ReplayModeRailProps = {
  analysisMode: ReplayAnalysisMode;
  onOpenHome: () => void;
  onOpenMatches: () => void;
  positionsView: PositionsView;
  onSelectAnalysisMode: (mode: ReplayAnalysisMode) => void;
  onSelectPositionsView: (view: PositionsView) => void;
};

const MODE_OPTIONS: Array<{ label: string; mode: ReplayAnalysisMode; positionsView?: PositionsView }> = [
  { label: "Live", mode: "live" },
  { label: "Utility", mode: "utilityAtlas" },
  { label: "Paths", mode: "positions", positionsView: "paths" },
  { label: "Player", mode: "positions", positionsView: "player" },
  { label: "Heatmap", mode: "heatmap" },
];

export function ReplayModeRail({
  analysisMode,
  onOpenHome,
  onOpenMatches,
  positionsView,
  onSelectAnalysisMode,
  onSelectPositionsView,
}: ReplayModeRailProps) {
  return (
    <nav className="dr-mapfirst-mode-rail" aria-label="Replay navigation">
      <button className="dr-mapfirst-mode-brand" onClick={onOpenHome} type="button" aria-label="Open Home">
        <img src="/DemoRead_Logo.png" alt="DemoRead" decoding="async" />
      </button>
      <div className="dr-mapfirst-mode-rail-list">
        <div className="dr-mapfirst-rail-section dr-mapfirst-rail-section-shell">
          <button className="dr-mapfirst-rail-button dr-mapfirst-shell-button" onClick={onOpenHome} type="button">
            Home
          </button>
          <button className="dr-mapfirst-rail-button dr-mapfirst-shell-button" onClick={onOpenMatches} type="button">
            Matches
          </button>
        </div>
        <div className="dr-mapfirst-rail-section dr-mapfirst-rail-section-tools">
          {MODE_OPTIONS.map((entry) => {
            const active = analysisMode === entry.mode && (entry.mode !== "positions" || entry.positionsView === positionsView);
            return (
              <button
                key={`${entry.mode}-${entry.positionsView ?? "default"}`}
                className={
                  active
                    ? "dr-mapfirst-rail-button dr-mapfirst-mode-button dr-mapfirst-rail-button-active"
                    : "dr-mapfirst-rail-button dr-mapfirst-mode-button"
                }
                onClick={() => {
                  if (active) {
                    return;
                  }

                  onSelectAnalysisMode(entry.mode);
                  if (entry.positionsView) {
                    onSelectPositionsView(entry.positionsView);
                  }
                }}
                aria-current={active ? "page" : undefined}
                type="button"
              >
                {entry.label}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
