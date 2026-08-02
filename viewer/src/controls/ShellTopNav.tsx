import { FeedbackWidget } from "./FeedbackWidget";

type Props = {
  actionLabel?: string;
  feedbackContext?: Record<string, unknown>;
  localMatchCount: number;
  parserBridgeAvailable: boolean;
  shellPage: "home" | "matches" | "proMatches" | "stats";
  statsParent?: "matches" | "proMatches";
  onAction?: () => void;
  actionDisabled?: boolean;
  onOpenHome: () => void;
  onOpenMatches: () => void;
  onOpenProMatches: () => void;
};

const DEMOREAD_LOGO_SRC = "/brand/demoread-logo.png";

export function ShellTopNav({
  actionLabel,
  feedbackContext,
  localMatchCount,
  parserBridgeAvailable,
  shellPage,
  statsParent = "matches",
  onAction,
  actionDisabled = false,
  onOpenHome,
  onOpenMatches,
  onOpenProMatches,
}: Props) {
  const fallbackActionLabel = localMatchCount > 0 ? "Open Matches" : "Start Local Review";
  const homeActive = shellPage === "home";
  const matchesActive = shellPage === "matches" || (shellPage === "stats" && statsParent === "matches");
  const proMatchesActive = shellPage === "proMatches" || (shellPage === "stats" && statsParent === "proMatches");
  const showStaticHomeStatus = shellPage === "home";

  return (
    <header className="home-top-nav">
      <button className="home-top-nav-brand" onClick={onOpenHome}>
        <img className="home-top-nav-logo" src={DEMOREAD_LOGO_SRC} alt="DemoRead" decoding="async" />
      </button>

      <nav className="home-top-nav-links" aria-label="Product navigation">
        <button
          className={`home-top-nav-link ${homeActive ? "home-top-nav-link-active" : ""}`}
          onClick={onOpenHome}
        >
          Home
        </button>
        <button
          className={`home-top-nav-link ${matchesActive ? "home-top-nav-link-active" : ""}`}
          onClick={onOpenMatches}
        >
          Matches
        </button>
        <button
          className={`home-top-nav-link ${proMatchesActive ? "home-top-nav-link-active" : ""}`}
          onClick={onOpenProMatches}
        >
          Pro Matches
        </button>
      </nav>

      <div className="home-top-nav-utilities">
        <span className={`home-top-nav-status ${!showStaticHomeStatus && parserBridgeAvailable ? "home-top-nav-status-live" : ""}`}>
          {showStaticHomeStatus ? "Early Access" : parserBridgeAvailable ? "Review Ready" : "Upload Paused"}
        </span>
        {feedbackContext ? <FeedbackWidget context={feedbackContext} /> : null}
        {onAction ? (
          <button className="home-top-nav-cta" onClick={onAction} disabled={actionDisabled}>
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
