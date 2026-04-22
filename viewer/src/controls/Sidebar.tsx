type Props = {
  onSelectShellPage: (page: "home" | "matches") => void;
};

export function Sidebar({ onSelectShellPage }: Props) {
  return (
    <aside className="sidebar replay-sidebar">
      <div className="replay-sidebar-layout">
        <section className="replay-rail-global">
          <button className="replay-rail-brand-button replay-rail-brand-button-global" onClick={() => onSelectShellPage("home")}>
            <img className="replay-rail-brand-logo" src="/DR Icon.png" alt="DemoRead" decoding="async" />
            <strong>DR</strong>
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
        </section>
      </div>
    </aside>
  );
}
