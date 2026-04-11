# Historical note

This review is kept for audit/history only.

- It is fully addressed or explicitly closed as no-action.
- It is not an active planning source.
- Use `plans.md` plus the current docs for active execution.

---

# CS2 Mastermind — Code Review 2026-04-04

## Approach
Area-by-area in priority order. Each area: read the relevant code, identify issues, fix or log to plans.md.

---

## 1. Parser correctness & edge cases

### Findings

**1a. `byInferno` in `tracker.go` duplicates `stablePlayerID` logic — maintenance risk**
`tracker.go:394–405` re-derives the thrower player ID from the inferno object using inline string logic
that mirrors `entities.go:stablePlayerID`. If `stablePlayerID`'s format ever changes, this path
breaks silently. The fix is to expose player ID derivation as a shared function the tracker can call,
or (simpler) store the already-resolved `throwerID` on the entity at `TrackThrow` time and use it
in `byInferno` directly rather than re-deriving from the raw `Inferno` object.

**~~1b. `infernoCenter` vs `infernoActiveCenter` mismatch in `utility_handlers.go`~~**
`InfernoStart` and `InfernoExpired` event handlers call `infernoCenter(e.Inferno.Fires())`, which
averages ALL fire points including inactive ones. The frame-synced `SyncInfernos` path calls
`infernoActiveCenter`, which prefers active fires and falls back to all. The event-driven path is
less accurate, especially on `InfernoExpired` when many fires are dying. Both paths should use
the same active-fires-first strategy. The standalone `infernoCenter` function in
`frame_sampling.go` is not used by any other caller — it exists only to serve these two
event handlers.

**1c. Bomb time inference: no signal in the artifact about which path was used**
`output.go:bombTimeSeconds` tries `gs.Rules().BombTime()` first (game state at parse end), then
falls back to `inferBombTimeSeconds()` (median of actual plant→explode tick differences). These
are very different in nature — one is a config read, the other is a statistical estimate — but the
canonical artifact doesn't distinguish them. A note in `SourceDemo.Notes` (or a separate
`bombTimeInferred bool` field) would make debugging easier when the inferred value is wrong.

**1d. Null Steam ID: no duplicate name detection in semantic validation**
`stablePlayerID` with null `SteamID64` uses `player:{name}:{userID}`. Two bots with the same
display name get distinct IDs. The semantic validator doesn't detect or warn about this. This is
tracked in plans.md as a known gap. Parser-side mitigation would be a validation warning emitted
into `SourceDemo.Notes` when multiple synthetic IDs share a display name.

**1e. `positions/stream.go` gap-fills missing ticks with all-zero/nil/dead samples**
`Builder.Append` fills tick gaps (lines 89–93) with `Sample{Tick: tick}` — alive=false, all
nil/zero. If a player is alive but skipped for a frame (e.g., mid-round team transition edge case),
their stream gets false "dead" samples, causing trail breaks in the viewer that don't correspond
to real deaths. This is probably rare in practice but worth noting.

### Status

- [x] Findings documented
- [x] ~~1a: expose shared player ID derivation function (or simplify `byInferno` matching)~~
- [x] ~~1b: replace `infernoCenter` with `infernoActiveCenter` in event handlers; delete standalone function~~
- [x] ~~1c: emit inference path signal in artifact (Notes or new field)~~
- [x] ~~1d: on hold — tracked in plans.md~~
- [x] ~~1e: on hold — low frequency, not a correctness risk in practice~~

---

## 2. Position Player completeness

### Findings

**2a. Stream array access ignores `sampleIntervalTicks` — latent bug**
`appendTrailPoint` in `positionsAnalysis.ts` computes `sampleIndex = tick - stream.sampleOriginTick`
and accesses `stream.alive[sampleIndex]` directly. This is correct only when `sampleIntervalTicks = 1`.
The same assumption exists in `interpolatePlayerStreamSample` in `playerStream.ts`:
`baseIndex = Math.floor(currentTick - stream.sampleOriginTick)` — no division by
`sampleIntervalTicks`. The parser always emits interval=1 today (`positions/stream.go:104`),
but the schema permits any interval and this code would silently produce wrong results if
the parser ever changes. Both functions should divide the relative tick offset by
`sampleIntervalTicks` before indexing.

**2b. `updatePositionPlayerSelections` resets `selectedPlayerId` to selection[0] on every add**
`App.tsx:294`: `setSelectedPlayerId(nextSelections[0]?.playerIds[0] ?? null)`. When a second
player is added to the compare set, `selectedPlayerId` snaps back to the first selection's
primary player ID. The second player appears as a ghost on the map but is not "selected" in the
live replay context. This may be intentional (the live player context tracks one player), but it's
non-obvious and could explain why jump-to-live from the second selected player behaves differently
than expected.

**2c. `positionsView === "paths"` does not clear `positionPlayerSelections`**
`handlePositionsViewChange` sets `setPositionPlayerSelections([])` when switching to "paths"
(line 410). But switching from "positions" mode to any other analysis mode (e.g., "heatmap" or
"live") via `handleAnalysisModeChange` does NOT clear `positionPlayerSelections`. Selections
persist invisibly across mode switches. Next time the user enters positions/player mode, the old
selection is restored silently. Could be useful UX or a stale context bug — either way it needs
a deliberate decision documented.

### Status

- [x] Findings documented
- [x] ~~2a: fix `appendTrailPoint` and `interpolatePlayerStreamSample` to divide by `sampleIntervalTicks`~~
- [x] ~~2b: decide and document intended behavior for `selectedPlayerId` in multi-compare mode~~
- [x] ~~2c: decide whether to clear or preserve `positionPlayerSelections` on mode switch~~

---

## 3. Viewer data integrity

### Findings

**3a. No timeout or cancellation on `parseDemoFile`**
A large demo or a hung parser blocks `parseDemoFile` indefinitely. The user sees the ingest
progress UI but has no way to cancel. The ingest state is shown, so the UX isn't completely
opaque, but a hung upload gives no feedback after the upload completes. A reasonable upper
bound (e.g., 5 minutes for the parser response) with a clear error message would help.

**3b. Schema validation in `validateReplay` uses `strict: false`**
`schema.ts:6`: `new Ajv2020({ allErrors: true, strict: false })`. `strict: false` disables
Ajv's strict mode, which silently ignores unrecognized schema keywords and unknown formats.
This means schema drift (adding a new keyword the schema validator doesn't know) won't surface
as an error. Given the schema is internal and fully controlled, this is low risk but worth
knowing.

**3c. `loadReplayURL` fetches from an unrestricted `url` parameter**
`loader.ts:15`: the `url` parameter is used directly in a `fetch()` call. This is only called
from `onFixtureLoad` (which prefixes `/fixtures/`) so it's not a real injection risk in practice,
but the function itself doesn't constrain the URL. Worth noting if this function is ever used in
a different callsite.

**3d. Ingest error state not cleared on successful fixture load**
`onFixtureLoad` calls `setError(null)` at the top of the try block (`loader.ts` pattern matches
`onDemoFileChange`). Good — both paths clear error state on attempt start. Confirmed clean.

### Status

- [x] Findings documented
- [x] ~~3a: add timeout/abort to `parseDemoFile` (or accept as known limitation)~~
- [x] ~~3b: document `strict: false` rationale in schema.ts comment~~
- [x] ~~3c: no action needed (callsite-constrained)~~

---

## 4. Code quality & structure

### Findings

**~~4a. `infernoCenter` in `frame_sampling.go` is a one-off function that creates inconsistency~~**
Used only in `utility_handlers.go` InfernoStart/InfernoExpired handlers. `infernoActiveCenter`
in `tracker.go` is a better version of the same thing. After fixing 1b above, `infernoCenter`
in `frame_sampling.go` becomes dead code and should be deleted.

**4b. `appendTrailPoint` pushes a new segment object without reusing `displayStartTick`/`displayEndTick`**
When a trail breaks at a dead sample, it pushes `{ displayEndTick, displayStartTick, points: [...currentSegment] }`.
The segment boundaries are the full round display range, not the segment's actual tick range. This
is fine for rendering (segments are per-round, not per-alive-window), but the field names suggest
they should reflect the segment's actual range. Minor naming confusion.

**4c. `Build()` in rounds builder sorts PlayerStreams by PlayerID (alphabetical)**
`builder.go:166`: `out.PlayerStreams[i].PlayerID < out.PlayerStreams[j].PlayerID`. This deterministically
orders streams but the sort key (`player:name:uid` or `steam:12345`) is not particularly useful
for any downstream consumer. The viewer rebuilds its own player ordering from `replay.players`.
Not a bug, just dead sort complexity.

**4d. `animateRoundIndexing` in `useReplayLoader.ts` is visual-only fake progress**
The "indexing" animation is a time-delayed counter that doesn't correspond to any real work.
This is intentional UX polish, but the `delay` function creates real async overhead per round
(up to 1200ms total). For a match with 30 rounds this is ~40ms per round, which is acceptable.
Just worth knowing it's cosmetic.

### Status

- [x] Findings documented
- [x] ~~4a: delete `infernoCenter` from `frame_sampling.go` after fixing 1b~~
- [x] ~~4b, 4c, 4d: no action needed~~

---

## 5. Docs & plans hygiene

### Findings

**5a. `plans.md` Done section is ~100 entries of iterative Position Player UI churn**
The Done section tracks every intermediate revert and layout experiment. This creates significant
noise for future agents reading the file. The planning note at the top says "Done should reflect
what actually landed" — but many entries are superseded intermediate versions of the same feature.
Recommend: collapse the Position Player churn into one summary entry, keep the landmark
architectural decisions.

**~~5b. `docs/06-current-status.md` is accurate and concise~~** — no action needed.

**~~5c. `AGENTS.md` references both Go parser startup and Node bridge~~** — still accurate per docs/08.

### Status

- [x] Findings documented
- [x] ~~5a: prune plans.md Done section — collapse Position Player churn into summary entries~~

---

## Summary of actionable items (priority order)

| # | File(s) | Issue | Action |
|---|---------|-------|--------|
| ~~1b~~ | `utility_handlers.go`, `frame_sampling.go`, `tracker.go` | ~~`infernoCenter` vs `infernoActiveCenter` mismatch~~ | ~~Replace event handler calls; delete `infernoCenter`~~ |
| ~~1a~~ | `tracker.go`, `entities.go` | ~~Duplicate player ID derivation in `byInferno`~~ | ~~Refactor~~ |
| ~~2a~~ | `positionsAnalysis.ts`, `playerStream.ts` | ~~`sampleIntervalTicks` not used in index math~~ | ~~Fix index calculation~~ |
| ~~2c~~ | `App.tsx` | ~~`positionPlayerSelections` not cleared on mode switch~~ | ~~Decide + document~~ |
| ~~2b~~ | `App.tsx` | ~~`selectedPlayerId` snaps to selection[0] on compare add~~ | ~~Decide + document~~ |
| ~~1c~~ | `output.go`, `types.go` | ~~Bomb time inference path not signaled in artifact~~ | ~~Add note to SourceDemo.Notes~~ |
| ~~3a~~ | `parserBridge.ts` | ~~No timeout/abort on `parseDemoFile`~~ | ~~Add AbortController timeout~~ |
| ~~5a~~ | `plans.md` | ~~Done section noise~~ | ~~Prune iterative churn entries~~ |

---

## Progress

| Area | Status |
|------|--------|
| 1. Parser correctness | reviewed |
| 2. Position Player | reviewed |
| 3. Viewer data integrity | reviewed |
| 4. Code quality | reviewed |
| 5. Docs hygiene | completed |

