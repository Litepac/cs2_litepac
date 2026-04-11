import { useMemo, useState, type ChangeEvent, type KeyboardEvent, type MouseEvent } from "react";

import type { FixtureIndex } from "../replay/fixtures";
import type { DemoIngestState } from "../replay/ingestState";
import type { MatchLibraryEntry } from "../replay/matchLibrary";
import type { LoaderIssue } from "../app/useReplayLoader";
import { IngestTracker } from "./IngestTracker";

type Props = {
  demoIngestState: DemoIngestState | null;
  error: LoaderIssue | null;
  fixtures: FixtureIndex["files"];
  libraryHydrated: boolean;
  matches: MatchLibraryEntry[];
  loadingSource: "demo" | "fixture" | "replay" | null;
  parserBridgeAvailable: boolean;
  onDemoFileChange: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  onDeleteMatch: (id: string) => void | Promise<void>;
  onFixtureLoad: (fileName: string) => void | Promise<void>;
  onOpenMatch: (id: string) => void;
  onOpenStats: (id: string) => void;
};

export function MatchesPage({
  demoIngestState,
  error,
  fixtures,
  libraryHydrated,
  matches,
  loadingSource,
  parserBridgeAvailable,
  onDemoFileChange,
  onDeleteMatch,
  onFixtureLoad,
  onOpenMatch,
  onOpenStats,
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
          entry.summary.teamAPlayersLabel,
          entry.summary.teamBPlayersLabel,
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
  const uploadDisabled = loadingSource != null || !parserBridgeAvailable;
  const showParserOfflineNotice = !parserBridgeAvailable && demoIngestState == null;

  return (
    <section className="matches-page matches-page-library">
      <header className="matches-library-header-shell">
        <div className="matches-library-heading">
          <div className="eyebrow">Matches</div>
          <h1>Matches</h1>
          <p>{libraryHydrated ? "Local demo library." : "Loading your local demo library."}</p>
        </div>

        <label
          className={`matches-upload-button ${uploadDisabled ? "matches-upload-button-disabled" : ""}`}
          aria-disabled={uploadDisabled}
        >
          <span>Upload Demo</span>
          <small>{parserBridgeAvailable ? "Parser-backed local ingest" : "Upload unavailable while parser is offline"}</small>
          <input type="file" accept=".dem" onChange={onDemoFileChange} disabled={uploadDisabled} />
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
                : "Local parser offline"}
          </span>
        </div>
      </div>

      {demoIngestState ? <IngestTracker state={demoIngestState} /> : null}
      {showParserOfflineNotice ? (
        <section className="matches-notice matches-notice-warning">
          <div>
            <strong>Local parser offline</strong>
            <p>Uploads are disabled until the local parser API responds again.</p>
          </div>
          <small>Start the local parser path, then verify <code>/api/health</code>.</small>
        </section>
      ) : null}
      {error ? (
        <section className="matches-notice matches-notice-error">
          <div>
            <strong>{error.title}</strong>
            <p>{error.message}</p>
          </div>
          {error.hint ? <small>{error.hint}</small> : null}
        </section>
      ) : null}

      <section className="match-library match-library-primary">
        <div className="match-library-header">
          <div>
            <div className="card-title">Library</div>
            <strong>{libraryStatus}</strong>
          </div>
          <span>Map, uploaded time, who played, result, and open action only</span>
        </div>

        {!libraryHydrated ? (
          <div className="match-library-empty">
            <strong>Loading local match library</strong>
            <p>Reading saved matches from browser storage before the library opens.</p>
          </div>
        ) : filteredMatches.length > 0 ? (
          <div className="match-table">
            <div className="match-table-head">
              <span>Match</span>
              <span>Times</span>
              <span>Teams</span>
              <span>Result & actions</span>
            </div>

            {filteredMatches.map((entry) => (
              <div
                key={entry.id}
                className={`match-row match-row-openable match-row-${winnerAccent(entry.summary.teamAResult, entry.summary.teamBResult)}`}
                role="button"
                tabIndex={loadingSource != null ? -1 : 0}
                aria-label={`Open ${entry.summary.mapName} replay`}
                onClick={() => {
                  if (loadingSource == null) {
                    onOpenMatch(entry.id);
                  }
                }}
                onKeyDown={(event) => handleMatchRowKeyDown(event, loadingSource != null, () => onOpenMatch(entry.id))}
              >
                <span className="match-cell match-map-cell">
                  <span className="match-map-copy">
                    <strong>{entry.summary.mapName}</strong>
                    <small>{entry.replay.map.mapId}</small>
                  </span>
                </span>

                <span className="match-cell match-date-cell">
                  {entry.summary.playedLabel ? (
                    <span className="match-time-pair">
                      <small>{entry.summary.playedStatusLabel}</small>
                      <strong>{entry.summary.playedLabel}</strong>
                    </span>
                  ) : null}
                  <span className="match-time-pair" title={entry.summary.sourceLabel}>
                    <small>{entry.summary.addedStatusLabel}</small>
                    <strong>{entry.summary.addedLabel}</strong>
                  </span>
                </span>

                <span className="match-cell match-teams-cell">
                  <span className="match-team-block">
                    <strong className={`match-team-name match-team-name-${entry.summary.teamAResult}`}>{entry.summary.teamAName}</strong>
                    <span className="match-team-roster">{entry.summary.teamAPlayersLabel}</span>
                  </span>
                  <small className="match-team-divider">vs</small>
                  <span className="match-team-block">
                    <strong className={`match-team-name match-team-name-${entry.summary.teamBResult}`}>{entry.summary.teamBName}</strong>
                    <span className="match-team-roster">{entry.summary.teamBPlayersLabel}</span>
                  </span>
                </span>

                <span className="match-cell match-outcome-cell">
                  <span className={`match-score-cell match-score-cell-${winnerAccent(entry.summary.teamAResult, entry.summary.teamBResult)}`}>
                    <span className="match-score-label">
                      {entry.summary.winnerTeamName ? `${entry.summary.winnerTeamName} won` : "Match draw"}
                    </span>
                    <span className="match-score-line">
                      <strong className={`match-score-token match-score-token-${entry.summary.teamAResult}`}>{entry.summary.teamAScore}</strong>
                      <small>-</small>
                      <strong className={`match-score-token match-score-token-${entry.summary.teamBResult}`}>{entry.summary.teamBScore}</strong>
                    </span>
                  </span>

                  <span className="match-action-cell">
                    <button
                      type="button"
                      className="match-action-button"
                      onClick={(event) => handleActionClick(event, () => onOpenStats(entry.id))}
                      disabled={loadingSource != null}
                    >
                      Stats
                    </button>
                    <button
                      type="button"
                      className="match-action-button match-action-button-open"
                      onClick={(event) => handleActionClick(event, () => onOpenMatch(entry.id))}
                      disabled={loadingSource != null}
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      className="match-action-button match-action-button-delete"
                      onClick={(event) => handleActionClick(event, () => void onDeleteMatch(entry.id))}
                      disabled={loadingSource != null}
                    >
                      Delete
                    </button>
                  </span>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="match-library-empty">
            <strong>{query || mapFilter !== "all" ? "No matches match the current filters" : "No local matches yet"}</strong>
            <p>
              {query || mapFilter !== "all"
                ? "Adjust the current search or map filter to widen the library results."
                : parserBridgeAvailable
                  ? "Upload a `.dem` to start building the local parser-backed match library."
                  : "Bring the local parser back online first, then upload a `.dem` to build the local match library."}
            </p>
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

function winnerAccent(teamAResult: "win" | "loss" | "draw", teamBResult: "win" | "loss" | "draw") {
  if (teamAResult === "win") {
    return "team-a-win";
  }

  if (teamBResult === "win") {
    return "team-b-win";
  }

  return "draw";
}

function handleActionClick(event: MouseEvent<HTMLButtonElement>, action: () => void) {
  event.stopPropagation();
  action();
}

function handleMatchRowKeyDown(event: KeyboardEvent<HTMLDivElement>, disabled: boolean, action: () => void) {
  if (disabled) {
    return;
  }

  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    action();
  }
}
