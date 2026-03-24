type Props = {
  parserBridgeAvailable: boolean;
  onOpenMatches: () => void;
};

const valueCards = [
  {
    label: "Parser First",
    title: "Replay truth stays canonical",
    copy: "Raw demos go through the local parser bridge, become `mastermind.replay.json`, and only then enter the viewer.",
  },
  {
    label: "Map First",
    title: "Built for 2D operator review",
    copy: "The workspace is designed around map dominance, compact roster read, and replay controls that stay dense instead of dashboard-heavy.",
  },
  {
    label: "Trust First",
    title: "No guessed stats or fake state",
    copy: "If parser-backed truth is missing or uncertain, the viewer omits it instead of inventing a neat-looking answer.",
  },
];

export function HomePage({ parserBridgeAvailable, onOpenMatches }: Props) {
  return (
    <section className="home-page">
      <div className="home-hero">
        <div className="eyebrow">Replay Workspace</div>
        <h2>Trustworthy CS2 demo review built around canonical replay truth</h2>
        <p>
          Mastermind is moving beyond a raw replay sandbox into a real operator product. Parse local demos through the
          ingest bridge, keep them in a match library, and open the 2D replay workspace only when the canonical replay is ready.
        </p>
        <div className="home-hero-actions">
          <button className="home-primary-button" onClick={onOpenMatches}>Open Matches</button>
          <span className={`home-bridge-status ${parserBridgeAvailable ? "home-bridge-status-live" : ""}`}>
            {parserBridgeAvailable ? "Parser bridge online" : "Parser bridge offline"}
          </span>
        </div>
      </div>

      <div className="home-value-grid">
        {valueCards.map((card) => (
          <article key={card.title} className="home-value-card">
            <div className="entry-card-label">{card.label}</div>
            <strong>{card.title}</strong>
            <p>{card.copy}</p>
          </article>
        ))}
      </div>

      <section className="home-showcase">
        <div className="home-showcase-copy">
          <div className="card-title">What The App Is Becoming</div>
          <strong>A welcoming front door, a dedicated matches page, and a replay workspace that still stays parser-first.</strong>
          <p>
            The home page introduces the product. The matches page manages uploaded demos and canonical replay files. The
            viewer remains focused on replay reading, not parsing or inventing metadata in the browser runtime.
          </p>
        </div>
        <div className="home-showcase-points">
          <div className="home-showcase-point">
            <span>01</span>
            <strong>Upload `.dem` locally</strong>
            <p>The local parser API ingests demos and returns a validated replay artifact for the app.</p>
          </div>
          <div className="home-showcase-point">
            <span>02</span>
            <strong>Keep a match library</strong>
            <p>Matches are presented by map, teams, score, and added date rather than by raw filename.</p>
          </div>
          <div className="home-showcase-point">
            <span>03</span>
            <strong>Open the operator workspace</strong>
            <p>Map, roster, utility, bomb, and round review all stay driven by canonical replay truth.</p>
          </div>
        </div>
      </section>
    </section>
  );
}
