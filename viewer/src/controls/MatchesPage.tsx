import { useMemo, useState, type ChangeEvent } from "react";

import type { FixtureIndex } from "../replay/fixtures";
import type { DemoIngestState } from "../replay/ingestState";
import type { MatchLibraryEntry } from "../replay/matchLibrary";
import { IngestTracker } from "./IngestTracker";

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
  const [query, setQuery] = useState("");
  const [mapFilter, setMapFilter] = useState("all");

  const maps = useMemo(
    () =>
      Array.from(new Set(matches.map((entry) => `${entry.replay.map.mapId}|||${entry.summary.mapName}`))).map((item) => {
        const [value, label] = item.split("|||");
        return { value, label };
      }),
    [matches],
  );

  const filteredMatches = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return matches.filter((entry) => {
      const matchesMap = mapFilter === "all" || entry.replay.map.mapId === mapFilter;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        [
          entry.summary.mapName,
          entry.replay.map.mapId,
          entry.summary.teamAName,
          entry.summary.teamBName,
          entry.summary.sourceLabel,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesMap && matchesQuery;
    });
  }, [mapFilter, matches, query]);

  const libraryStatus = !libraryHydrated
    ? "Hydrating your local match library"
    : filteredMatches.length === 0
      ? query || mapFilter !== "all"
        ? "No matches match the current filters"
        : "No matches yet"
      : `${filteredMatches.length} match${filteredMatches.length === 1 ? "" : "es"}`;

  return (
    <section className="matches-page matches-page-library">
      <header className="matches-library-header-shell">
        <div className="matches-library-heading">
          <div className="eyebrow">Matches</div>
          <h1>Matches</h1>
          <p>{libraryHydrated ? "Local demo library." : "Loading your local demo library."}</p>
        </div>

        <label
          className={`matches-upload-button ${loadingSource != null ? "matches-upload-button-disabled" : ""}`}
          aria-disabled={loadingSource != null}
        >
          <span>Upload Demo</span>
          <input type="file" accept=".dem" onChange={onDemoFileChange} disabled={loadingSource != null} />
        </label>
      </header>

      <div className="matches-toolbar">
        <label className="matches-toolbar-control matches-toolbar-search">
          <span>Search</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Map, team, or source"
          />
        </label>

        <label className="matches-toolbar-control">
          <span>Map</span>
          <select value={mapFilter} onChange={(event) => setMapFilter(event.target.value)}>
            <option value="all">All maps</option>
            {maps.map((map) => (
              <option key={map.value} value={map.value}>
                {map.label}
              </option>
            ))}
          </select>
        </label>

        <div className="matches-toolbar-meta">
          <strong>{libraryStatus}</strong>
          <span>
            {loadingSource && demoIngestState == null
              ? `Loading ${loadingSource === "demo" ? "demo" : loadingSource}...`
              : parserBridgeAvailable
                ? "Local ingest bridge online"
                : "Local ingest bridge not detected"}
          </span>
        </div>
      </div>

      {demoIngestState ? <IngestTracker state={demoIngestState} /> : null}

      <section className="match-library match-library-primary">
        <div className="match-library-header">
          <div>
            <div className="card-title">Library</div>
            <strong>{libraryStatus}</strong>
          </div>
          <span>Map, teams, date, score, and open action only</span>
        </div>

        {!libraryHydrated ? (
          <div className="match-library-empty">Loading saved local matches from browser storage.</div>
        ) : filteredMatches.length > 0 ? (
          <div className="match-table">
            <div className="match-table-head">
              <span>Match</span>
              <span>Date</span>
              <span>Teams</span>
              <span>Score</span>
              <span>Source</span>
              <span></span>
            </div>

            {filteredMatches.map((entry) => (
              <button key={entry.id} className="match-row" onClick={() => onOpenMatch(entry.id)} disabled={loadingSource != null}>
                <span className="match-cell match-map-cell">
                  <span
                    className="match-map-preview"
                    style={{
                      backgroundImage: `linear-gradient(180deg, rgba(4, 8, 12, 0.16), rgba(4, 8, 12, 0.74)), url(${entry.summary.mapImageUrl})`,
                    }}
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
          <div className="match-library-empty">
            {query || mapFilter !== "all"
              ? "No local matches match the current search and map filter."
              : "Upload a demo to start building your local match library."}
          </div>
        )}
      </section>

      {fixtures.length > 0 ? (
        <details className="matches-secondary-tools">
          <summary>
            <span className="card-title">Secondary Tools</span>
            <strong>Fixtures & validation</strong>
          </summary>
          <div className="entry-fixture-list matches-fixture-list">
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
        </details>
      ) : null}
    </section>
  );
}
