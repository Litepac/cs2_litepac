import { useMemo, useState, type ChangeEvent, type KeyboardEvent, type MouseEvent } from "react";

import type { LoaderIssue } from "../app/useReplayLoader";
import type { FixtureIndex } from "../replay/fixtures";
import type { DemoIngestState } from "../replay/ingestState";
import type { MatchLibraryEntry } from "../replay/matchLibrary";
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

export function MatchesPageV2({
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
    <section className="matches-page matches-page-v2">
      <header className="matches-v2-header-shell">
        <div className="matches-v2-header-copy">
          <div className="eyebrow">Matches v2</div>
          <h1>Matches</h1>
          <p>Redline pass on the local demo library. Same parser-backed flow, denser and sharper than the current page.</p>
        </div>

        <div className="matches-v2-header-side">
          <div className="matches-v2-header-metrics" aria-label="Matches v2 status">
            <div className="matches-v2-header-metric">
              <span>Library</span>
              <strong>{libraryStatus}</strong>
            </div>
            <div className="matches-v2-header-metric">
              <span>Parser</span>
              <strong>{parserBridgeAvailable ? "Online" : "Offline"}</strong>
            </div>
          </div>

          <label
            className={`matches-v2-upload-button ${uploadDisabled ? "matches-v2-upload-button-disabled" : ""}`}
            aria-disabled={uploadDisabled}
          >
            <span>Upload Demo</span>
            <small>{parserBridgeAvailable ? "Parser-backed local ingest" : "Upload unavailable while parser is offline"}</small>
            <input type="file" accept=".dem" onChange={onDemoFileChange} disabled={uploadDisabled} />
          </label>
        </div>
      </header>

      <section className="matches-v2-toolbar-shell">
        <label className="matches-v2-toolbar-control matches-v2-toolbar-search">
          <span>Search library</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Map, team, player, or source"
          />
        </label>

        <label className="matches-v2-toolbar-control">
          <span>Map filter</span>
          <select value={mapFilter} onChange={(event) => setMapFilter(event.target.value)}>
            <option value="all">All maps</option>
            {maps.map((map) => (
              <option key={map.value} value={map.value}>
                {map.label}
              </option>
            ))}
          </select>
        </label>

        <div className="matches-v2-toolbar-status">
          <span className="matches-v2-kicker">Status</span>
          <strong>{libraryStatus}</strong>
          <small>
            {loadingSource && demoIngestState == null
              ? `Loading ${loadingSource === "demo" ? "demo" : loadingSource}...`
              : parserBridgeAvailable
                ? "Local ingest bridge online"
                : "Local parser offline"}
          </small>
        </div>
      </section>

      {demoIngestState ? <IngestTracker state={demoIngestState} /> : null}
      {showParserOfflineNotice ? (
        <section className="matches-v2-notice matches-v2-notice-warning">
          <div>
            <strong>Local parser offline</strong>
            <p>Uploads stay disabled until the local parser API responds again.</p>
          </div>
          <small>
            Bring the local path back up, then verify <code>/api/health</code>.
          </small>
        </section>
      ) : null}
      {error ? (
        <section className="matches-v2-notice matches-v2-notice-error">
          <div>
            <strong>{error.title}</strong>
            <p>{error.message}</p>
          </div>
          {error.hint ? <small>{error.hint}</small> : null}
        </section>
      ) : null}

      <section className="matches-v2-library">
        <div className="matches-v2-library-head">
          <div>
            <span className="matches-v2-kicker">Local library</span>
            <strong>{libraryStatus}</strong>
          </div>
          <p>Map, time, teams, result, and replay actions in a tighter Redline layout.</p>
        </div>

        {!libraryHydrated ? (
          <div className="matches-v2-empty">
            <strong>Loading local match library</strong>
            <p>Reading saved matches from browser storage before the library opens.</p>
          </div>
        ) : filteredMatches.length > 0 ? (
          <div className="matches-v2-row-list">
            {filteredMatches.map((entry) => (
              <article
                key={entry.id}
                className={`matches-v2-row matches-v2-row-${winnerAccent(entry.summary.teamAResult, entry.summary.teamBResult)}`}
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
                <div className="matches-v2-row-map">
                  <strong>{entry.summary.mapName}</strong>
                  <small>{entry.replay.map.mapId}</small>
                </div>

                <div className="matches-v2-row-times">
                  {entry.summary.playedLabel ? (
                    <span className="matches-v2-meta-pair">
                      <small>{entry.summary.playedStatusLabel}</small>
                      <strong>{entry.summary.playedLabel}</strong>
                    </span>
                  ) : null}
                  <span className="matches-v2-meta-pair" title={entry.summary.sourceLabel}>
                    <small>{entry.summary.addedStatusLabel}</small>
                    <strong>{entry.summary.addedLabel}</strong>
                  </span>
                </div>

                <div className="matches-v2-row-teams">
                  <div className="matches-v2-team-stack">
                    <span className={`matches-v2-team-name matches-v2-team-name-${entry.summary.teamAResult}`}>{entry.summary.teamAName}</span>
                    <small>{entry.summary.teamAPlayersLabel}</small>
                  </div>
                  <span className="matches-v2-row-versus">vs</span>
                  <div className="matches-v2-team-stack">
                    <span className={`matches-v2-team-name matches-v2-team-name-${entry.summary.teamBResult}`}>{entry.summary.teamBName}</span>
                    <small>{entry.summary.teamBPlayersLabel}</small>
                  </div>
                </div>

                <div className="matches-v2-row-outcome">
                  <div className="matches-v2-score-stack">
                    <span className="matches-v2-score-label">
                      {entry.summary.winnerTeamName ? `${entry.summary.winnerTeamName} won` : "Match draw"}
                    </span>
                    <strong>
                      <span>{entry.summary.teamAScore}</span>
                      <small>-</small>
                      <span>{entry.summary.teamBScore}</span>
                    </strong>
                  </div>

                  <div className="matches-v2-card-actions">
                    <button
                      type="button"
                      className="matches-v2-action matches-v2-action-muted"
                      onClick={(event) => handleActionClick(event, () => onOpenStats(entry.id))}
                      disabled={loadingSource != null}
                    >
                      Stats
                    </button>
                    <button
                      type="button"
                      className="matches-v2-action matches-v2-action-primary"
                      onClick={(event) => handleActionClick(event, () => onOpenMatch(entry.id))}
                      disabled={loadingSource != null}
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      className="matches-v2-action matches-v2-action-danger"
                      onClick={(event) => handleActionClick(event, () => void onDeleteMatch(entry.id))}
                      disabled={loadingSource != null}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="matches-v2-empty">
            <strong>{query || mapFilter !== "all" ? "No matches match the current filters" : "No local matches yet"}</strong>
            <p>
              {query || mapFilter !== "all"
                ? "Adjust the search or map filter to widen the library results."
                : parserBridgeAvailable
                  ? "Upload a `.dem` to start building the local parser-backed match library."
                  : "Bring the local parser back online first, then upload a `.dem` to build the local match library."}
            </p>
          </div>
        )}
      </section>

      {fixtures.length > 0 ? (
        <details className="matches-v2-secondary-tools">
          <summary>
            <span className="matches-v2-kicker">Secondary tools</span>
            <strong>Fixtures & validation</strong>
          </summary>
          <div className="entry-fixture-list matches-v2-fixture-list">
            {fixtures.map((fixture) => (
              <button
                key={fixture.fileName}
                className="entry-fixture-item matches-v2-fixture-item"
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

function handleMatchRowKeyDown(event: KeyboardEvent<HTMLElement>, disabled: boolean, action: () => void) {
  if (disabled) {
    return;
  }

  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    action();
  }
}
