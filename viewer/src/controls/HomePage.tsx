type Props = {
  onOpenMatches: () => void;
};

const DEMOREAD_LOGO_PARTS = {
  icon: "/brand/dr-icon.png",
  demo: "/brand/demo.png",
  read: "/brand/read.png",
  tagline: "/brand/demoread-tagline.png",
} as const;

const heroTimelineTicks = Array.from({ length: 18 }, (_, index) => index);
const heroEventTicks = ["Kill", "Smoke", "Plant", "Trade"];

const valuePoints = [
  ["See what happened", "Follow the round in 2D instead of guessing from memory."],
  ["Review faster", "Get to the useful moments without replaying dead time."],
  ["Find mistakes", "Spot timing, spacing, utility, deaths, and bomb decisions."],
  ["Explain it clearly", "Show teammates the round, not just a clip."],
];

const workflowSteps = [
  ["Upload demo", "Add a local CS2 demo."],
  ["Review the round", "Open the map, timeline, utility, paths, and bomb context."],
  ["Share the lesson", "Use the visual round state to explain what to change next."],
];

const audienceRows = [
  ["Players", "Review your own demos with less guesswork."],
  ["Teams", "Make round reviews easier to explain and repeat."],
  ["Analysts / reviewers", "Move from demo file to round evidence faster."],
];

export function HomePage({
  onOpenMatches,
}: Props) {
  function handleSeeFlow() {
    document.getElementById("landing-flow-heading")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section className="landing-page">
      <header className="landing-hero">
        <div className="landing-hero-copy">
          <span className="landing-kicker">DemoRead for CS2 demos</span>
          <h1>See the round clearly.</h1>
          <p>
            Turn a local CS2 demo into a focused 2D review. Understand what happened, find the mistake faster, and
            explain the round with less guesswork.
          </p>
          <div className="landing-actions" aria-label="Homepage actions">
            <button type="button" className="landing-button landing-button-primary" onClick={onOpenMatches}>
              Open Matches
            </button>
            <button type="button" className="landing-button landing-button-secondary" onClick={handleSeeFlow}>
              See Review Flow
            </button>
          </div>
        </div>

        <aside className="landing-product-proof" aria-label="DemoRead replay workflow preview">
          <div className="landing-proof-brand" aria-hidden="true">
            <img src="/brand/demoread-logo.png" alt="" decoding="async" />
          </div>
          <div className="landing-proof-window">
            <div className="landing-proof-map" aria-hidden="true">
              <span className="landing-proof-site landing-proof-site-a">A</span>
              <span className="landing-proof-site landing-proof-site-b">B</span>
              <i className="landing-proof-token landing-proof-token-ct landing-proof-token-1" />
              <i className="landing-proof-token landing-proof-token-ct landing-proof-token-2" />
              <i className="landing-proof-token landing-proof-token-t landing-proof-token-3" />
              <i className="landing-proof-token landing-proof-token-t landing-proof-token-4" />
              <svg viewBox="0 0 100 64" preserveAspectRatio="none">
                <path d="M18 48 C34 38 42 30 55 30 C68 30 75 20 84 14" />
                <path d="M22 16 C36 22 46 24 60 18" />
              </svg>
            </div>
            <div className="landing-proof-inspector">
              <span>Death Review</span>
              <strong>What happened here?</strong>
              <p>Victim, killer, weapon, trade timing, flash state, and nearby support in one evidence card.</p>
            </div>
          </div>
          <div className="landing-proof-timeline" aria-hidden="true">
            {heroEventTicks.map((event) => (
              <span key={event}>{event}</span>
            ))}
          </div>
        </aside>
      </header>

      <section className="landing-value" aria-labelledby="landing-value-heading">
        <div className="landing-section-heading">
          <span className="landing-kicker">Why it matters</span>
          <h2 id="landing-value-heading">A round is easier to fix when everyone can see it.</h2>
        </div>
        <div className="landing-value-grid">
          {valuePoints.map(([title, body]) => (
            <article key={title}>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-flow" aria-labelledby="landing-flow-heading">
        <div className="landing-section-heading">
          <span className="landing-kicker">How it works</span>
          <h2 id="landing-flow-heading">From demo file to clear round review.</h2>
        </div>
        <div className="landing-flow-steps">
          {workflowSteps.map(([title, body], index) => (
            <article key={title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-audience" aria-labelledby="landing-audience-heading">
        <div className="landing-section-heading">
          <span className="landing-kicker">Who it is for</span>
          <h2 id="landing-audience-heading">Built for people who review rounds seriously.</h2>
        </div>
        <div className="landing-audience-row">
          {audienceRows.map(([title, body]) => (
            <article key={title}>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-final-cta">
        <div>
          <span className="landing-kicker">Alpha testing</span>
          <h2>Bring a demo. Leave with a clearer round.</h2>
          <p>
            Alpha testing is for real review sessions. Upload a demo, open the round, and tell us where the review
            feels fast, clear, or still too hard.
          </p>
        </div>
        <div className="landing-final-actions">
          <button type="button" className="landing-button landing-button-primary" onClick={onOpenMatches}>
            Start Alpha Review
          </button>
          <span>Early access / local demo flow</span>
        </div>
      </section>
    </section>
  );
}
