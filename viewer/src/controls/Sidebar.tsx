import type { ChangeEvent } from "react";

import type { FixtureIndex } from "../replay/fixtures";
import type { Replay } from "../replay/types";

type Props = {
  error: string | null;
  fixtures: FixtureIndex["files"];
  replay: Replay | null;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onFixtureLoad: (fileName: string) => void | Promise<void>;
};

export function Sidebar({ error, fixtures, replay, onFileChange, onFixtureLoad }: Props) {
  return (
    <aside className="sidebar">
      <div className="brand-card">
        <div className="eyebrow">Replay Core</div>
        <h1>Mastermind</h1>
      </div>

      <section className="sidebar-card">
        <div className="card-title">Source</div>
        <label className="file-input">
          <span>Load replay JSON</span>
          <input type="file" accept=".json" onChange={onFileChange} />
        </label>
        {error ? <pre className="error-box">{error}</pre> : null}
      </section>

      {fixtures.length > 0 ? (
        <section className="sidebar-card">
          <div className="card-title">Fixtures</div>
          <div className="fixture-list">
            {fixtures.map((fixture) => (
              <button key={fixture.fileName} className="fixture-item" onClick={() => void onFixtureLoad(fixture.fileName)}>
                <span>{fixture.label}</span>
                <strong>Load</strong>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {replay ? (
        <section className="sidebar-card">
          <div className="card-title">Replay Meta</div>
          <dl className="meta-grid">
            <div className="meta-pair">
              <dt>Demo</dt>
              <dd>{replay.sourceDemo.fileName}</dd>
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
        </section>
      ) : null}
    </aside>
  );
}
