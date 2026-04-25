# Replay V1 Product Spec

## Product stance
The 2D replayer is the main product surface for the first version of Litepac.

Home, Matches, and Stats should support that replayer, but they should not pull the product center of gravity away from replay review and replay analysis.

The replay product should answer four questions quickly:

- What happened in this round?
- Why did this fight, execute, rotate, or retake happen?
- What did one player actually do over time?
- Which movement or utility patterns repeated across rounds?

## Non-negotiables
- Parser and canonical replay own truth
- Viewer only maps, interpolates, and presents that truth
- No fake tactical labels, no synthetic replay events, and no stats that imply certainty the parser does not provide
- The normal replay timeline stays the transport source for live playback and `Position Player`
- If a replay visual repeatedly looks plausible but cannot be tied back to canonical data, remove or hide it until parser truth exists

## V1 user workflows

### 1. Round review
The user opens a match, selects a round, presses play, scrubs the normal timeline, and understands the round sequence from map tokens, utility, kill markers, and bomb state.

Minimum bar:

- round switching is instant enough to stay in flow
- timeline scrubbing maps to the same parser-backed tick range shown on the map
- kills, bomb events, and utility events are visible enough to reconstruct the round
- selected-player focus helps answer "what was this player doing right now?"

### 2. Player study
The user selects one player and studies their movement, timing, spacing, deaths, and utility usage inside one round and across multiple rounds.

Minimum bar:

- selecting a player clearly emphasizes that player in live replay
- non-selected players remain useful context without overpowering the selected player
- `Position Player` lets the user compare where that player is at the same relative moment across rounds
- `Position Player` should be selected-player-first; broad all-player comparison is secondary and should be explicit rather than the default state
- selecting one player in `Position Player` shows only that player unless an explicit context mode is introduced
- CT / T / All filtering works for both broad comparison and selected-player comparison
- clicking a cross-round token jumps into the correct round and tick in live replay
- round labels on cross-round tokens use canonical round numbers and remain optional

### 3. Utility review
The user reviews utility timing, throw paths, detonation points, and effect windows to understand executes, holds, and retakes.

Minimum bar:

- smokes, flashes, HE, fire, and decoys are distinguishable
- utility paths and detonation points are readable enough to inspect one throw family at a time
- utility markers can jump into live replay at the relevant throw/detonation moment
- utility rendering never invents behavior beyond parser events and sampled trajectories

### 4. Cross-round pattern analysis
The user leaves pure live playback and enters a replay-analysis mode to inspect repeated movement or utility behavior, then jumps back to live replay when a specific example is interesting.

Minimum bar:

- `Position Paths` answers "what routes were taken?"
- `Position Player` answers "where is this player at this same relative moment across rounds?"
- `Position Player` is for repeated player tendencies and timing study, then a jump back into one concrete round
- `Utility Atlas` answers "what utility was thrown from where to where?"
- `Heatmap` remains a supporting occupancy/hotspot layer, not the main hero mode
- each analysis mode is clearly separate, parser-backed, and jump-linked back into live replay where that is analytically useful

## Replay UI requirements

### Map stage
- Map projection must stay stable and parser-aligned
- Player tokens must prioritize position, side, facing, health/alive state, selected-player emphasis, and readable names
- Bomb and utility visuals should stay visible without covering the core player fight read
- Dense fights need a clutter strategy: reduce label collisions, de-emphasize non-selected context, or hide lower-priority badges before the map becomes unreadable

### Timeline and navigation
- One normal transport timeline should remain the main interaction model for live replay
- Event markers should make kills, utility, and bomb moments discoverable without turning the dock into a second dashboard
- Round navigation should make side-by-side round review fast
- Any analysis mode that reuses the timeline must share the same tick anchor and round range as live playback

### Player focus
- Clicking a player in live replay should give a strong but not noisy focus state
- Clearing focus must be obvious
- Cross-round player analysis should not silently retain stale team or scope filters
- If side-swapped versions of one player are shown separately, the UI and state model must make that side context explicit

## Supporting surfaces

### Home
Home should sell the product and explain that Replay is the main workflow entry, not present a dashboard of fake platform metrics.

### Matches
Matches should behave as the local match library and ingest desk.

Minimum bar:

- parser availability is visible
- upload failures are actionable
- opening a match lands in Replay quickly
- Stats is available as a secondary route, but Replay remains the primary action

### Stats
Stats is a secondary support surface for match summaries and parser-backed analysis tables.

For V1, Stats should not drive the roadmap more than Replay correctness and replay-analysis usefulness.

## Current implementation audit

## What already meets the V1 bar
- Parser-backed live playback, round switching, timeline scrubbing, player selection, and live roster are implemented in `viewer/src/app/App.tsx`, `viewer/src/app/useReplayPlayback.ts`, `viewer/src/controls/ReplayMapFirstPage.tsx`, and `viewer/src/canvas/ReplayStage.tsx`
- Core utility, combat, bomb, and player rendering already come from canonical replay streams and events through `viewer/src/canvas/replayStage/*`
- `Utility Atlas`, `Position Paths`, `Position Player`, and `Heatmap` already exist as distinct replay-analysis modes wired through `viewer/src/replay/replayAnalysis.ts`, `viewer/src/replay/positionsAnalysis.ts`, `viewer/src/replay/heatmapAnalysis.ts`, `viewer/src/controls/ReplayMapFirstPage.tsx`, `viewer/src/controls/replay-map-first/ReplayDock.tsx`, and `viewer/src/canvas/ReplayStage.tsx`
- Cross-round utility and position overlays can already jump back into live replay through the app-level handlers in `viewer/src/app/App.tsx`
- Home / Matches / Replay / Stats are already split into separate product surfaces

## What does not yet meet the V1 bar

### Priority 1: `Position Player` still needs to feel like a finished player-study tool
Current gap:

- broad All Players comparison, selected-player isolation, side filtering, round-number labels, click-to-round jumps, and snapshot/live alignment have all had issues recently and still need direct browser validation against real fixtures
- the mode is structurally separate from `Position Paths`, but it still does not yet feel like the strongest movement-analysis workflow in the product
- the feature should now be judged primarily as a selected-player timing/pattern study tool, not as a broad all-player inspection surface

Likely next actions:

- validate `Position Player` on Mirage, Inferno, Overpass, and Ancient fixtures with one side-swapping player and one stable-side player
- keep route lines in `Position Paths` unchanged while tuning `Position Player` tokens, labels, jump behavior, and context handling
- add focused fixture-backed regression checks around snapshot extraction and jump targets
- keep broad compare explicit and secondary so the user is pushed toward one-player study by default

### Priority 2: Live replay player focus is useful, but not yet a full player-study workflow
Current gap:

- selecting a player emphasizes them, but there is no stronger "follow this player across the round" workflow beyond current selection and trail emphasis
- after jumping from `Position Player`, the live round does not yet offer an explicit faded-context mode for the selected player if that proves analytically useful

Likely next actions:

- improve selected-player readability first before adding new controls
- if faded context helps after snapshot jumps, implement it as a deliberate selected-player context state, not a generic overlay hack

### Priority 3: Dense-fight readability still needs one pass after movement analysis is solid
Current gap:

- labels, health/utility badges, utility bodies, and event cues can still compete in heavy fights

Likely next actions:

- audit one dense-round fixture and decide which non-selected visuals should soften or disappear first
- avoid any clutter fix that breaks parser-aligned positioning or hides key combat truth

### Priority 4: Utility review is functional, but analysis-to-live storytelling can still get sharper
Current gap:

- `Utility Atlas` exists and jumps to live replay, but utility review still needs a stronger "inspect one throw, then see the round consequence" feel

Likely next actions:

- improve one throw-family inspection path at a time, starting with flash or smoke
- keep all utility views tied to parser-backed throw paths, detonation ticks, and active windows

### Priority 5: Local ingest and startup are mostly workable, but parser startup trust is still split by machine policy
Current gap:

- the intended default is the Go parser API spawned by the viewer dev server
- on this machine, Windows Application Control currently forces the fallback Node bridge

Likely next actions:

- keep `/api/health` verification in the startup runbook
- do not debug replay visuals against an unknown parser process
- if machine policy changes, verify the Go API path again before assuming parity

## V1 non-goals
- full esports broadcast UI
- long-term player identity or team-role modeling from one match
- dashboard-style platform analytics
- parser-inferred tactics that cannot be defended from canonical replay truth
- adding new replay-analysis modes before `Position Player` and the live replayer feel strong

## Recommended execution order
1. Make `Position Player` reliable and analytically useful.
2. Improve selected-player study inside live replay without adding fake data.
3. Run one dense-fight readability pass on the map stage and dock.
4. Sharpen utility review/jump flows where parser truth is already strong.
5. Only then spend serious iteration budget on Stats polish or new analysis modes.
