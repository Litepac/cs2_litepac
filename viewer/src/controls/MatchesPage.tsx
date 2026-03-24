import type { ChangeEvent } from "react";

import { IngestTracker } from "./IngestTracker";
import type { FixtureIndex } from "../replay/fixtures";
import type { DemoIngestState } from "../replay/ingestState";
import type { MatchLibraryEntry } from "../replay/matchLibrary";

type Props = {
  demoIngestState: DemoIngestState | null;
  fixtures: FixtureIndex["files"];
  libraryHydrated: boolean;
  matches: MatchLibraryEntry[];
  loadingSource: "demo" | "fixture" | "replay" | null;
  parserBridgeAvailable: boolean;
  onDemoFileChange: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  onFixtureLoad: (fileName: string) => void | Promise<void>;
  onOpenMatch: (id: string) => void;
};

export function MatchesPage({
  demoIngestState,
  fixtures,
  libraryHydrated,
  matches,
  loadingSource,
  parserBridgeAvailable,
  onDemoFileChange,
  onFixtureLoad,
  onOpenMatch,
}: Props) {
  return (
    <section className="matches-page">
      <div className="entry-state-copy">
        <div className="eyebrow">Your Matches</div>
        <h2>Keep uploaded demos in a clean local match page, then open the replay workspace from there</h2>
        <p>
          This page is the operational library. Upload a raw `.dem` through the parser bridge, keep it local, and
          open the match from the table instead of jumping straight into the viewer.
        </p>
      </div>

      <div className="entry-grid entry-grid-single">
        <label className={`entry-card ${parserBridgeAvailable ? "" : "entry-card-disabled"}`}>
          <div className="entry-card-label">Upload Demo</div>
          <strong>.dem via parser bridge</strong>
          <p>
            {parserBridgeAvailable
              ? "Parse a local CS2 demo through the local ingest bridge and add it to the match library."
              : "The bridge status still reads offline, but you can still try `.dem` upload if the local parser API is running."}
          </p>
          <input type="file" accept=".dem" onChange={onDemoFileChange} disabled={loadingSource != null} />
        </label>
      </div>

      {demoIngestState ? <IngestTracker state={demoIngestState} /> : null}

      <div className="match-library">
        <div className="match-library-header">
          <div>
            <div className="card-title">Matches</div>
            <strong>
              {!libraryHydrated
                ? "Loading local matches..."
                : matches.length === 0
                  ? "No uploaded matches yet"
                  : `${matches.length} local match${matches.length === 1 ? "" : "es"}`}
            </strong>
          </div>
          <span>Map, teams, score, and added date only</span>
        </div>

        {!libraryHydrated ? (
          <div className="match-library-empty">Hydrating your local match library from browser storage.</div>
        ) : matches.length > 0 ? (
          <div className="match-table">
            <div className="match-table-head">
              <span>Map</span>
              <span>Date Added</span>
              <span>Teams</span>
              <span>Score</span>
              <span>Source</span>
              <span></span>
            </div>

            {matches.map((entry) => (
              <button key={entry.id} className="match-row" onClick={() => onOpenMatch(entry.id)} disabled={loadingSource != null}>
                <span className="match-cell match-map-cell">
                  <span
                    className="match-map-preview"
                    style={{ backgroundImage: `linear-gradient(180deg, rgba(4, 8, 12, 0.2), rgba(4, 8, 12, 0.72)), url(${entry.summary.mapImageUrl})` }}
                  />
                  <span className="match-map-copy">
                    <strong>{entry.summary.mapName}</strong>
                    <small>{entry.replay.map.mapId}</small>
                  </span>
                </span>
                <span className="match-cell match-date-cell">{entry.summary.addedLabel}</span>
                <span className="match-cell match-teams-cell">
                  <strong>{entry.summary.teamAName}</strong>
                  <small>vs</small>
                  <strong>{entry.summary.teamBName}</strong>
                </span>
                <span className="match-cell match-score-cell">
                  <strong>{entry.summary.teamAScore}</strong>
                  <small>-</small>
                  <strong>{entry.summary.teamBScore}</strong>
                </span>
                <span className="match-cell match-source-cell">{entry.summary.sourceLabel}</span>
                <span className="match-cell match-action-cell">
                  <strong>Open</strong>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="match-library-empty">Uploaded demos will appear here as match entries. Raw demo filenames stay out of the main list.</div>
        )}
      </div>

      {fixtures.length > 0 ? (
        <div className="entry-fixtures">
          <div className="entry-fixtures-header">
            <div className="card-title">Fixtures</div>
            <span>Quick local validation set</span>
          </div>
          <div className="entry-fixture-list">
            {fixtures.map((fixture) => (
              <button
                key={fixture.fileName}
                className="entry-fixture-item"
                onClick={() => void onFixtureLoad(fixture.fileName)}
                disabled={loadingSource != null}
              >
                <span>{fixture.label}</span>
                <strong>Load</strong>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {loadingSource && demoIngestState == null ? <div className="entry-status">Loading {loadingSource === "demo" ? "demo" : loadingSource}...</div> : null}
    </section>
  );
}
