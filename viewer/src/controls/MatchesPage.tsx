import { useMemo, useState, type ChangeEvent, type KeyboardEvent, type MouseEvent, type RefObject } from "react";

import type { LoaderIssue } from "../app/useReplayLoader";
import type { FixtureIndex } from "../replay/fixtures";
import type { DemoIngestState } from "../replay/ingestState";
import type { MatchLibraryEntry } from "../replay/matchLibrary";
import type { ParserBridgeHealth } from "../replay/parserBridge";
import { IngestTracker } from "./IngestTracker";

type Props = {
  demoIngestState: DemoIngestState | null;
  error: LoaderIssue | null;
  fixtures: FixtureIndex["files"];
  libraryHydrated: boolean;
  matches: MatchLibraryEntry[];
  loadingSource: "demo" | "fixture" | "replay" | null;
  parserBridgeAvailable: boolean;
  parserBridgeHealth: ParserBridgeHealth;
  uploadInputRef?: RefObject<HTMLInputElement | null>;
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
  parserBridgeHealth,
  uploadInputRef,
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

  const filtersActive = query.trim().length > 0 || mapFilter !== "all";
  const libraryStatus = !libraryHydrated
    ? "Hydrating local library"
    : filteredMatches.length === 0
      ? filtersActive
        ? "No matches match the current filters"
        : "No matches yet"
      : `${filteredMatches.length} match${filteredMatches.length === 1 ? "" : "es"}`;
  const loadingLabel =
    loadingSource && demoIngestState == null
      ? `Loading ${loadingSource === "demo" ? "demo" : loadingSource}...`
      : null;
  const uploadDisabled = loadingSource != null || !parserBridgeAvailable;
  const ingestError = error?.context === "demo" ? error : null;
  const showParserOfflineNotice = !parserBridgeAvailable && demoIngestState == null && ingestError == null;
  const savedMatchLabel = libraryHydrated ? `${matches.length} saved` : "Hydrating";
  const visibleMatchLabel = libraryHydrated ? `${filteredMatches.length} visible` : "Loading";
  const mapCountLabel = libraryHydrated ? `${maps.length} map${maps.length === 1 ? "" : "s"}` : "Loading";
  const parserModeLabel = parserBridgeHealth.mode === "go-api"
    ? "Go parser"
    : parserBridgeHealth.mode === "node-bridge"
    ? "Fallback bridge"
    : !parserBridgeAvailable && parserBridgeHealth.bridge
    ? "Fallback blocked"
    : parserBridgeHealth.bridge
    ? "Fallback bridge"
    : parserBridgeHealth.service
      ? "Go parser"
      : parserBridgeAvailable
        ? "Parser online"
        : "Parser offline";
  const parserStatusCopy = parserBridgeAvailable
    ? parserModeLabel
    : parserBridgeHealth.error || "Upload disabled until the parser returns.";

  function clearFilters() {
    setQuery("");
    setMapFilter("all");
  }

  return (
    <section className="matches-page matches-page-library matches-page-redline">
      <header className="matches-redline-header">
        <div className="matches-redline-heading">
          <span className="matches-redline-kicker">Local match library</span>
          <h1>Matches</h1>
          <p>Upload local CS2 demos, then open a clean 2D review when the parser-backed replay is ready.</p>
        </div>

        <div className="matches-redline-header-panel" aria-label="Match library actions and status">
          <label
            className={`matches-redline-upload ${uploadDisabled ? "matches-redline-upload-disabled" : ""}`}
            aria-disabled={uploadDisabled}
          >
            <span>
              Upload Demo <small aria-hidden="true">{"->"}</small>
            </span>
            <small>{parserBridgeAvailable ? "Parser-backed local ingest" : "Parser offline"}</small>
            <input
              ref={uploadInputRef}
              id="matches-redline-upload-input"
              type="file"
              accept=".dem"
              onChange={onDemoFileChange}
              disabled={uploadDisabled}
            />
          </label>

          <section className="matches-redline-header-status">
            <span className="matches-redline-kicker">Current state</span>
            <strong>{loadingLabel ?? libraryStatus}</strong>
            <p>{parserStatusCopy}</p>
          </section>

          <section className="matches-redline-header-metrics" aria-label="Library metrics">
            <div>
              <span>Saved</span>
              <strong>{savedMatchLabel}</strong>
            </div>
            <div>
              <span>Visible</span>
              <strong>{visibleMatchLabel}</strong>
            </div>
            <div>
              <span>Maps</span>
              <strong>{mapCountLabel}</strong>
            </div>
            <div>
              <span>Parser</span>
              <strong>{parserBridgeAvailable ? parserModeLabel : parserBridgeHealth.bridge ? "Blocked" : "Offline"}</strong>
            </div>
          </section>
        </div>
      </header>

      <section className="matches-redline-controls" aria-label="Match library controls">
        <label className="matches-redline-control matches-redline-search">
          <span>Search</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Map, team, player, or source"
          />
        </label>

        <label className="matches-redline-control">
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

        <button
          type="button"
          className="matches-redline-clear"
          onClick={clearFilters}
          disabled={!filtersActive}
        >
          Clear filters
        </button>
      </section>

      {demoIngestState || ingestError ? <IngestTracker issue={ingestError} state={demoIngestState} /> : null}
      {showParserOfflineNotice ? (
        <section className="matches-redline-notice matches-redline-notice-warning">
          <div>
            <strong>Local parser offline</strong>
            <p>Uploads are disabled until the local parser API responds again.</p>
          </div>
          <small>
            Start the local parser path, then verify <code>/api/health</code>.
          </small>
        </section>
      ) : null}
      {error && error.context !== "demo" ? (
        <section className="matches-redline-notice matches-redline-notice-error">
          <div>
            <strong>{error.title}</strong>
            <p>{error.message}</p>
          </div>
          {error.hint ? <small>{error.hint}</small> : null}
        </section>
      ) : null}

      <section className="matches-redline-library" aria-labelledby="matches-redline-library-heading">
        <div className="matches-redline-library-head">
          <div>
            <span className="matches-redline-kicker">Reviewable demos</span>
            <h2 id="matches-redline-library-heading">{libraryStatus}</h2>
          </div>
          <p>Map, teams, score, uploaded time, and direct replay actions.</p>
        </div>

        {!libraryHydrated ? (
          <div className="matches-redline-empty">
            <strong>Loading local match library</strong>
            <p>Reading saved matches from browser storage before the library opens.</p>
          </div>
        ) : filteredMatches.length > 0 ? (
          <div className="matches-redline-table">
            <div className="matches-redline-table-head" aria-hidden="true">
              <span>Match</span>
              <span>Teams</span>
              <span>Score</span>
              <span>Time</span>
              <span>Actions</span>
            </div>

            {filteredMatches.map((entry) => (
              <article
                key={entry.id}
                className={`matches-redline-row matches-redline-row-${winnerAccent(entry.summary.teamAResult, entry.summary.teamBResult)}`}
                role="button"
                tabIndex={loadingSource != null ? -1 : 0}
                aria-label={`Open ${entry.summary.mapName}: ${entry.summary.teamAName} versus ${entry.summary.teamBName}`}
                onClick={() => {
                  if (loadingSource == null) {
                    onOpenMatch(entry.id);
                  }
                }}
                onKeyDown={(event) => handleRowKeyDown(event, () => onOpenMatch(entry.id), loadingSource != null)}
              >
                <div className="matches-redline-row-map">
                  <span>{entry.replay.map.mapId}</span>
                  <strong>{entry.summary.mapName}</strong>
                  <small>{entry.summary.sourceLabel}</small>
                </div>

                <div className="matches-redline-row-teams">
                  <div className="matches-redline-team">
                    <strong className={`matches-redline-team-name matches-redline-team-name-${entry.summary.teamAResult}`}>
                      {entry.summary.teamAName}
                    </strong>
                    <small>{entry.summary.teamAPlayersLabel}</small>
                  </div>
                  <span className="matches-redline-versus">vs</span>
                  <div className="matches-redline-team">
                    <strong className={`matches-redline-team-name matches-redline-team-name-${entry.summary.teamBResult}`}>
                      {entry.summary.teamBName}
                    </strong>
                    <small>{entry.summary.teamBPlayersLabel}</small>
                  </div>
                </div>

                <div className="matches-redline-score">
                  <span>{entry.summary.winnerTeamName ? `${entry.summary.winnerTeamName} won` : "Match draw"}</span>
                  <strong>
                    {entry.summary.teamAScore}
                    <small>-</small>
                    {entry.summary.teamBScore}
                  </strong>
                </div>

                <div className="matches-redline-time">
                  {entry.summary.playedLabel ? (
                    <span>
                      <small>{entry.summary.playedStatusLabel}</small>
                      <strong>{entry.summary.playedLabel}</strong>
                    </span>
                  ) : null}
                  <span>
                    <small>{entry.summary.addedStatusLabel}</small>
                    <strong>{entry.summary.addedLabel}</strong>
                  </span>
                </div>

                <div className="matches-redline-actions">
                  <button
                    type="button"
                    className="matches-redline-action matches-redline-action-secondary"
                    onClick={(event) => handleActionClick(event, () => onOpenStats(entry.id))}
                    disabled={loadingSource != null}
                  >
                    Stats
                  </button>
                  <button
                    type="button"
                    className="matches-redline-action matches-redline-action-primary"
                    onClick={(event) => handleActionClick(event, () => onOpenMatch(entry.id))}
                    disabled={loadingSource != null}
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    className="matches-redline-action matches-redline-action-danger"
                    onClick={(event) => handleActionClick(event, () => void onDeleteMatch(entry.id))}
                    disabled={loadingSource != null}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="matches-redline-empty">
            <strong>{filtersActive ? "No matches match the current filters" : "No local matches yet"}</strong>
            <p>
              {filtersActive
                ? "Clear the current search or map filter to widen the library results."
                : parserBridgeAvailable
                  ? "Upload a `.dem` to start building the local parser-backed match library."
                  : "Bring the local parser back online first, then upload a `.dem` to build the local match library."}
            </p>
            {filtersActive ? (
              <button type="button" className="matches-redline-clear matches-redline-empty-action" onClick={clearFilters}>
                Clear filters
              </button>
            ) : null}
          </div>
        )}
      </section>

      {fixtures.length > 0 ? (
        <details className="matches-redline-secondary-tools">
          <summary>
            <span className="matches-redline-kicker">Validation fixtures</span>
            <strong>Parser/replay test demos</strong>
          </summary>
          <div className="entry-fixture-list matches-redline-fixture-list">
            {fixtures.map((fixture) => (
              <button
                key={fixture.fileName}
                className="entry-fixture-item matches-redline-fixture-item"
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

function handleRowKeyDown(event: KeyboardEvent<HTMLElement>, action: () => void, disabled: boolean) {
  if (disabled) {
    return;
  }

  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    action();
  }
}
