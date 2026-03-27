type Props = {
  actionLabel?: string;
  localMatchCount: number;
  parserBridgeAvailable: boolean;
  shellPage: "home" | "matches" | "stats";
  onAction?: () => void;
  onOpenHome: () => void;
  onOpenMatches: () => void;
};

export function ShellTopNav({
  actionLabel,
  localMatchCount,
  parserBridgeAvailable,
  shellPage,
  onAction,
  onOpenHome,
  onOpenMatches,
}: Props) {
  const fallbackActionLabel = localMatchCount > 0 ? "Open Matches" : "Start Local Review";

  return (
    <header className="home-top-nav">
      <button className="home-top-nav-brand" onClick={onOpenHome}>
        <span className="home-top-nav-mark">&gt;_</span>
        <strong>Mastermind</strong>
      </button>

      <nav className="home-top-nav-links" aria-label="Product navigation">
        <button
          className={`home-top-nav-link ${shellPage === "home" ? "home-top-nav-link-active" : ""}`}
          onClick={onOpenHome}
        >
          Home
        </button>
        <button
          className={`home-top-nav-link ${shellPage !== "home" ? "home-top-nav-link-active" : ""}`}
          onClick={onOpenMatches}
        >
          Matches
        </button>
      </nav>

      <div className="home-top-nav-utilities">
        <span className={`home-top-nav-status ${parserBridgeAvailable ? "home-top-nav-status-live" : ""}`}>
          {parserBridgeAvailable ? "Bridge Online" : "Bridge Offline"}
        </span>
        {onAction ? (
          <button className="home-top-nav-cta" onClick={onAction}>
            {actionLabel || fallbackActionLabel}
          </button>
        ) : (
          <span className="home-top-nav-cta home-top-nav-cta-placeholder" aria-hidden="true">
            {actionLabel || fallbackActionLabel}
          </span>
        )}
      </div>
    </header>
  );
}
