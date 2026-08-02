import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
  type MouseEvent,
  type RefObject,
} from "react";

import type {
  MatchCompetition,
  MatchCompetitionTier,
  MatchLibraryEntry,
} from "../replay/matchLibrary";
import {
  filterProMatches,
  latestMajorEventName,
  normalizeCompetitionReferenceUrl,
  type ProMatchSort,
} from "../replay/proMatches";
import {
  loadProMatchCatalog,
  type ProMatchCatalogEntry,
  type ProMatchCatalogPage,
} from "../replay/proMatchProvider";
import styles from "./ProMatchesPage.module.css";

type Props = {
  libraryHydrated: boolean;
  loadingSource: "demo" | "fixture" | "replay" | null;
  matches: MatchLibraryEntry[];
  parserBridgeAvailable: boolean;
  proImportingRowId: string | null;
  uploadInputRef?: RefObject<HTMLInputElement | null>;
  onDemoFileChange: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  onImportProviderMatch: (entry: ProMatchCatalogEntry) => Promise<void>;
  onOpenMatch: (id: string) => void;
  onOpenStats: (id: string) => void;
  onUpdateCompetition: (id: string, competition: MatchCompetition | null) => Promise<void>;
};

type Draft = {
  eventName: string;
  playedAt: string;
  referenceUrl: string;
  stage: string;
  tier: MatchCompetitionTier;
};

const EMPTY_DRAFT: Draft = {
  eventName: "",
  playedAt: "",
  referenceUrl: "",
  stage: "",
  tier: "major",
};

export function ProMatchesPage({
  libraryHydrated,
  loadingSource,
  matches,
  parserBridgeAvailable,
  proImportingRowId,
  uploadInputRef,
  onDemoFileChange,
  onImportProviderMatch,
  onOpenMatch,
  onOpenStats,
  onUpdateCompetition,
}: Props) {
  const classifiableMatches = useMemo(() => matches.filter((entry) => entry.source !== "fixture"), [matches]);
  const proMatches = useMemo(() => matches.filter((entry) => entry.competition != null), [matches]);
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [eventFilter, setEventFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState<"all" | MatchCompetitionTier>("all");
  const [sort, setSort] = useState<ProMatchSort>("newest");
  const [providerCatalog, setProviderCatalog] = useState<ProMatchCatalogPage | null>(null);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [providerLoading, setProviderLoading] = useState(true);
  const [providerImportError, setProviderImportError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedMatchId && classifiableMatches.some((entry) => entry.id === selectedMatchId)) {
      return;
    }
    const next = classifiableMatches.find((entry) => entry.competition == null) ?? classifiableMatches[0] ?? null;
    setSelectedMatchId(next?.id ?? "");
    setDraft(draftForEntry(next));
  }, [classifiableMatches, selectedMatchId]);

  useEffect(() => {
    let cancelled = false;
    setProviderLoading(true);
    loadProMatchCatalog()
      .then((catalog) => {
        if (!cancelled) {
          setProviderCatalog(catalog);
          setProviderError(null);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setProviderError(error instanceof Error ? error.message : "The pro demo catalogue is unavailable.");
        }
      })
      .finally(() => {
        if (!cancelled) setProviderLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const events = useMemo(
    () => Array.from(new Set(proMatches.map((entry) => entry.competition?.eventName).filter(Boolean))).sort(),
    [proMatches],
  ) as string[];
  const latestMajor = useMemo(() => latestMajorEventName(proMatches), [proMatches]);
  const filteredMatches = useMemo(
    () => filterProMatches(proMatches, { eventName: eventFilter, query, sort, tier: tierFilter }),
    [eventFilter, proMatches, query, sort, tierFilter],
  );
  const filtersActive = query.trim().length > 0 || eventFilter !== "all" || tierFilter !== "all";
  const uploadDisabled = loadingSource != null || !parserBridgeAvailable;

  function selectMatch(id: string) {
    const entry = classifiableMatches.find((candidate) => candidate.id === id) ?? null;
    setSelectedMatchId(id);
    setDraft(draftForEntry(entry));
    setFormError(null);
  }

  async function saveCompetition(event: FormEvent) {
    event.preventDefault();
    if (!selectedMatchId) {
      setFormError("Choose an imported demo first.");
      return;
    }
    if (!draft.eventName.trim() || !draft.playedAt) {
      setFormError("Event name and played date are required.");
      return;
    }

    try {
      setSaving(true);
      setFormError(null);
      await onUpdateCompetition(selectedMatchId, {
        eventName: draft.eventName.trim(),
        playedAt: draft.playedAt,
        referenceUrl: normalizeCompetitionReferenceUrl(draft.referenceUrl),
        stage: draft.stage.trim() || null,
        tier: draft.tier,
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Competition metadata could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function removeCompetition(event: MouseEvent, id: string) {
    event.stopPropagation();
    try {
      setFormError(null);
      await onUpdateCompetition(id, null);
      if (selectedMatchId === id) {
        setDraft(EMPTY_DRAFT);
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Competition metadata could not be removed.");
    }
  }

  function clearFilters() {
    setQuery("");
    setEventFilter("all");
    setTierFilter("all");
  }

  function showLatestMajor() {
    if (!latestMajor) {
      return;
    }
    setTierFilter("major");
    setEventFilter(latestMajor);
    setSort("newest");
  }

  async function loadMoreProviderMatches() {
    if (!providerCatalog || providerLoading || providerCatalog.nextOffset >= providerCatalog.total) return;
    try {
      setProviderLoading(true);
      setProviderError(null);
      const next = await loadProMatchCatalog(providerCatalog.nextOffset);
      setProviderCatalog((current) => current == null ? next : {
        ...next,
        entries: dedupeProviderEntries([...current.entries, ...next.entries]),
        offset: 0,
      });
    } catch (error) {
      setProviderError(error instanceof Error ? error.message : "More pro demos could not be loaded.");
    } finally {
      setProviderLoading(false);
    }
  }

  async function importProviderMatch(entry: ProMatchCatalogEntry) {
    try {
      setProviderImportError(null);
      await onImportProviderMatch(entry);
    } catch (error) {
      setProviderImportError(error instanceof Error ? error.message : "The selected pro demo could not be imported.");
    }
  }

  return (
    <section className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.kicker}>Professional replay library</span>
          <h1>Pro Matches</h1>
          <p>
            Organize imported pro demos by event and stage, then open the same parser-backed replay and stats tools.
          </p>
        </div>

        <div className={styles.heroActions}>
          <button
            className={styles.uploadButton}
            type="button"
            disabled={uploadDisabled}
            onClick={() => uploadInputRef?.current?.click()}
          >
            {parserBridgeAvailable ? "Upload pro demo" : "Uploads paused"}
          </button>
          <input
            ref={uploadInputRef}
            className={styles.hiddenInput}
            type="file"
            accept=".dem"
            onChange={onDemoFileChange}
            disabled={uploadDisabled}
          />
          <small>Upload first, then add verified event context below.</small>
        </div>

        <div className={styles.heroMetrics} aria-label="Pro match library summary">
          <div><span>Matches</span><strong>{libraryHydrated ? proMatches.length : "—"}</strong></div>
          <div><span>Events</span><strong>{libraryHydrated ? events.length : "—"}</strong></div>
          <div><span>Latest major</span><strong>{latestMajor ?? "Not added"}</strong></div>
        </div>
      </header>

      <section className={styles.sourceBoundary}>
        <div>
          <span className={styles.kicker}>Source boundary</span>
          <strong>Replay facts come from the demo</strong>
        </div>
        <p>
          Map, teams, score, players, and rounds are parser-derived. Event context is either entered by you or imported with
          explicit dataset attribution. HLTV reference links remain outbound links and are never scraped by DemoRead.
        </p>
      </section>

      <section className={styles.provider} aria-labelledby="provider-catalog-heading">
        <div className={styles.libraryHead}>
          <div>
            <span className={styles.kicker}>Free provider catalogue</span>
            <h2 id="provider-catalog-heading">
              {providerCatalog ? `${providerCatalog.total.toLocaleString()} maps available` : "Available pro demos"}
            </h2>
          </div>
          {providerCatalog ? (
            <a className={styles.attribution} href={providerCatalog.attributionUrl} target="_blank" rel="noreferrer">
              {providerCatalog.source} · {providerCatalog.license}
            </a>
          ) : null}
        </div>

        <p className={styles.providerNotice}>
          Catalogue metadata is provider-supplied. Selecting Import downloads only that map, then DemoRead parses the original
          <code>.dem</code> before adding it locally. The provider's analysis JSON is never used as replay truth.
        </p>

        {providerLoading && !providerCatalog ? (
          <EmptyState title="Loading the pro demo catalogue" copy="Fetching lightweight metadata only. No demos are downloaded yet." />
        ) : providerError && !providerCatalog ? (
          <EmptyState title="Pro demo catalogue unavailable" copy={providerError} />
        ) : providerCatalog && providerCatalog.entries.length > 0 ? (
          <>
            <div className={styles.providerList}>
              {providerCatalog.entries.map((entry) => {
                const importing = proImportingRowId === entry.rowId;
                return (
                  <article key={entry.rowId} className={styles.providerRow}>
                    <div className={styles.eventCell}>
                      <span className={styles.tier}>{entry.format || "pro"}</span>
                      <strong>{entry.event}</strong>
                      <small>{formatProviderDate(entry.matchDate)} · patch {entry.patchVersion || "unknown"}</small>
                    </div>
                    <div className={styles.teamsCell}>
                      <strong>{entry.team1}<span>{entry.score1}</span></strong>
                      <small>Map {entry.mapIndex} · {displayMapName(entry.mapName)}</small>
                      <strong>{entry.team2}<span>{entry.score2}</span></strong>
                    </div>
                    <div className={styles.providerMeta}>
                      <strong>{formatBytes(entry.demoBytes)}</strong>
                      <small>{entry.roundsPlayed > 0 ? `${entry.roundsPlayed} rounds` : "Demo available"}</small>
                    </div>
                    <div className={styles.rowActions}>
                      {entry.matchUrl ? <a href={entry.matchUrl} target="_blank" rel="noreferrer">Source</a> : null}
                      <button
                        type="button"
                        className={styles.openButton}
                        disabled={!parserBridgeAvailable || loadingSource != null}
                        onClick={() => void importProviderMatch(entry)}
                      >
                        {importing ? "Downloading & parsing…" : "Import & parse"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
            <div className={styles.providerFooter}>
              <span role="status" className={providerImportError || providerError ? styles.formError : styles.formHint}>
                {providerImportError ?? providerError ?? `${providerCatalog.entries.length} of ${providerCatalog.total.toLocaleString()} maps loaded. Downloads may be several hundred MB.`}
              </span>
              <button
                type="button"
                className={styles.majorShortcut}
                disabled={providerLoading || providerCatalog.nextOffset >= providerCatalog.total}
                onClick={() => void loadMoreProviderMatches()}
              >
                {providerLoading ? "Loading…" : "Load more"}
              </button>
            </div>
          </>
        ) : (
          <EmptyState title="No provider demos available" copy="The provider returned no safe importable demo rows." />
        )}
      </section>

      <form className={styles.classifier} onSubmit={saveCompetition}>
        <div className={styles.classifierHead}>
          <div>
            <span className={styles.kicker}>Classify an imported demo</span>
            <h2>Add event context</h2>
          </div>
          <p>This metadata stays separate from the canonical replay artifact.</p>
        </div>

        <div className={styles.classifierGrid}>
          <label className={styles.wideField}>
            <span>Imported match</span>
            <select value={selectedMatchId} onChange={(event) => selectMatch(event.target.value)} disabled={saving}>
              <option value="">Choose a local demo</option>
              {classifiableMatches.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.summary.teamAName} vs {entry.summary.teamBName} · {entry.summary.mapName}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Event</span>
            <input
              value={draft.eventName}
              onChange={(event) => setDraft((current) => ({ ...current, eventName: event.target.value }))}
              placeholder="IEM Cologne Major 2026"
              disabled={saving}
            />
          </label>
          <label>
            <span>Tier</span>
            <select
              value={draft.tier}
              onChange={(event) => setDraft((current) => ({ ...current, tier: event.target.value as MatchCompetitionTier }))}
              disabled={saving}
            >
              <option value="major">Major</option>
              <option value="premier">Premier</option>
              <option value="pro">Pro</option>
            </select>
          </label>
          <label>
            <span>Stage</span>
            <input
              value={draft.stage}
              onChange={(event) => setDraft((current) => ({ ...current, stage: event.target.value }))}
              placeholder="Playoffs · Semi-final"
              disabled={saving}
            />
          </label>
          <label>
            <span>Played date</span>
            <input
              type="date"
              value={draft.playedAt}
              onChange={(event) => setDraft((current) => ({ ...current, playedAt: event.target.value }))}
              disabled={saving}
            />
          </label>
          <label className={styles.wideField}>
            <span>Reference link <small>optional</small></span>
            <input
              type="url"
              value={draft.referenceUrl}
              onChange={(event) => setDraft((current) => ({ ...current, referenceUrl: event.target.value }))}
              placeholder="https://…"
              disabled={saving}
            />
          </label>
        </div>

        <div className={styles.classifierFooter}>
          <span role="status" className={formError ? styles.formError : styles.formHint}>
            {formError ?? (classifiableMatches.length > 0 ? "Ready to save local event context." : "Upload a demo to begin.")}
          </span>
          <button type="submit" disabled={saving || !selectedMatchId}>
            {saving ? "Saving…" : "Save to Pro Matches"}
          </button>
        </div>
      </form>

      <section className={styles.library} aria-labelledby="pro-matches-heading">
        <div className={styles.libraryHead}>
          <div>
            <span className={styles.kicker}>Curated match index</span>
            <h2 id="pro-matches-heading">{filteredMatches.length} visible</h2>
          </div>
          <button type="button" className={styles.majorShortcut} onClick={showLatestMajor} disabled={!latestMajor}>
            Latest major
          </button>
        </div>

        <div className={styles.filters}>
          <label className={styles.searchField}>
            <span>Search</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Team, player, map, or stage" />
          </label>
          <label>
            <span>Event</span>
            <select value={eventFilter} onChange={(event) => setEventFilter(event.target.value)}>
              <option value="all">All events</option>
              {events.map((eventName) => <option key={eventName} value={eventName}>{eventName}</option>)}
            </select>
          </label>
          <label>
            <span>Tier</span>
            <select value={tierFilter} onChange={(event) => setTierFilter(event.target.value as typeof tierFilter)}>
              <option value="all">All tiers</option>
              <option value="major">Majors</option>
              <option value="premier">Premier</option>
              <option value="pro">Pro</option>
            </select>
          </label>
          <label>
            <span>Order</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as ProMatchSort)}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </label>
          <button type="button" className={styles.clearButton} onClick={clearFilters} disabled={!filtersActive}>Clear</button>
        </div>

        {!libraryHydrated ? (
          <EmptyState title="Loading pro match library" copy="Reading local replay and event metadata." />
        ) : filteredMatches.length > 0 ? (
          <div className={styles.matchList}>
            {filteredMatches.map((entry) => {
              const competition = entry.competition;
              if (!competition) return null;
              return (
                <article key={entry.id} className={styles.matchRow}>
                  <div className={styles.eventCell}>
                    <span className={styles.tier}>{competition.tier}</span>
                    <strong>{competition.eventName}</strong>
                    <small>{competition.stage ?? "Stage not specified"} · {formatPlayedDate(competition.playedAt)}</small>
                  </div>
                  <div className={styles.teamsCell}>
                    <strong>{entry.summary.teamAName}<span>{entry.summary.teamAScore}</span></strong>
                    <small>{entry.summary.mapName}</small>
                    <strong>{entry.summary.teamBName}<span>{entry.summary.teamBScore}</span></strong>
                  </div>
                  <div className={styles.rowActions}>
                    {competition.referenceUrl ? (
                      <a href={competition.referenceUrl} target="_blank" rel="noreferrer">Reference</a>
                    ) : null}
                    <button type="button" onClick={() => onOpenStats(entry.id)} disabled={loadingSource != null}>Stats</button>
                    <button type="button" className={styles.openButton} onClick={() => onOpenMatch(entry.id)} disabled={loadingSource != null}>Open</button>
                    <button type="button" className={styles.removeButton} onClick={(event) => void removeCompetition(event, entry.id)}>Remove</button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : proMatches.length === 0 ? (
          <EmptyState title="No pro matches classified yet" copy="Upload a demo, then add its event, tier, stage, and played date above." />
        ) : (
          <EmptyState title="No matches fit these filters" copy="Clear the filters or choose another event." action={clearFilters} />
        )}
      </section>
    </section>
  );
}

function EmptyState({ title, copy, action }: { title: string; copy: string; action?: () => void }) {
  return (
    <div className={styles.emptyState}>
      <strong>{title}</strong>
      <p>{copy}</p>
      {action ? <button type="button" onClick={action}>Clear filters</button> : null}
    </div>
  );
}

function draftForEntry(entry: MatchLibraryEntry | null): Draft {
  const competition = entry?.competition;
  return competition
    ? {
        eventName: competition.eventName,
        playedAt: competition.playedAt,
        referenceUrl: competition.referenceUrl ?? "",
        stage: competition.stage ?? "",
        tier: competition.tier,
      }
    : { ...EMPTY_DRAFT };
}

function formatPlayedDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function formatProviderDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat(undefined, { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "Size unavailable";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
  const scaled = value / (1024 ** index);
  return `${scaled >= 100 || index === 0 ? scaled.toFixed(0) : scaled.toFixed(1)} ${units[index]}`;
}

function displayMapName(value: string) {
  const trimmed = value.replace(/^de_/, "").trim();
  return trimmed ? trimmed[0].toUpperCase() + trimmed.slice(1) : "Unknown map";
}

function dedupeProviderEntries(entries: ProMatchCatalogEntry[]) {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.rowId)) return false;
    seen.add(entry.rowId);
    return true;
  });
}
