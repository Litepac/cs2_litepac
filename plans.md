# plans.md

Planning note:
- `In Progress` means actively being worked now, not historically related.
- Paused or later work stays in `Planned` under `On Hold / Later`.
- `Done` should reflect what actually landed, not superseded intermediate versions.

## Planned
### Next Up
- Execute the Replay V1 spec in `docs/14-replay-v1-product-spec.md` with the 2D replayer as the primary product surface: finish `Position Player`, strengthen live selected-player study, improve dense-fight readability, and sharpen utility-review-to-live jumps before spending more iteration budget on Stats polish
- Add parser-backed match played time only if a trustworthy demo source is verified; the current parser + `demoinfocs` path does not expose a clean wall-clock match-played timestamp, so Matches should stay explicit about that gap instead of guessing from file metadata
- Investigate parser fallback identity for players with null Steam IDs, because duplicate synthetic IDs like `player:gunner:13` / `player:gunner:14` can represent one display name and should be validated parser-side before more viewer logic depends on that edge case
- Tighten ingest failure handling and empty-state guidance now that parser-backed round progress and the demo-only local match flow are in place
- Continue live visual QA against staged fixtures at 1080p and 1440p/2K
- Add fixture/integration coverage around parser-to-viewer ingest flow once the current product surfaces settle

### On Hold / Later
- Finish the replay bottom area with one tightly scoped geometry/readability pass so the dock feels unified, compact, and clearly separated from the round strip without regressing map space
- Polish the new match stats destination into a stronger premium analytical surface while keeping it table-first and limited to trustworthy parser-backed stats
- Tighten placement-aware CT/T role inference across the active map pool by refining one map at a time from staged fixture output, with Inferno, Overpass, Ancient, and Mirage now materially ahead of the rest and the remaining maps needing fixture-backed validation
- Productize the advanced stats tabs so the new data plumbing reads like a deliberate analysis product surface instead of raw debug tables, while keeping the current compact page structure
- Compress the advanced stats framing so the scoreboards start higher: one tighter analysis toolbar, fewer repeated explanatory bands, and shorter Roles / Style notes
- Calm the Stats scoreboard typography so player identity stays strongest, rating remains important but integrated, and secondary values stop competing equally
- Strip remaining pre-table promo chrome from Stats and reduce the stacked-card feeling so the route behaves more like one unified analysis surface
- Make the Summary table more ruthless by cutting secondary stats, keeping only first-read metrics, and softening the remaining grid so the data scans more naturally
- Continue moving Stats from "upgraded scoreboard" toward a real analysis product by exposing faster per-view takeaways before the tables
- Tighten parser edge cases found during visual replay checks
- Add canonical inferno footprint truth if future UI needs more than soft center-based fire rendering
- Add map calibration spot checks tied to known landmarks
- Reduce viewer bundle size and split heavy Pixi code paths
- Improve utility lifecycle fidelity after visual validation
- Tighten canonical replay fields where UI quality is blocked by missing trustworthy render data
- Reconcile intentional post-round sampling through `officialEndTick` with round/stream validation so parser truth stays internally consistent
- Make bomb timer/state fully parser-owned and event-backed so planted countdown truth no longer depends on fragile parse-end state or inference
- Consider a later Figma refinement loop for Home, Matches, shell consistency, and state polish once the product structure is stable enough for design refinement instead of active workflow churn
- Revisit a separate internal AI runtime surface only if direct VSCode/Codex integration becomes valuable enough to justify a true runtime-first sidecar instead of another staged prototype

## In Progress
- Execute the current high-value product path in this order without touching map fit unless a task explicitly requires it: `Position Player` polish first, then utility-to-live workflow, then replay-shell QA at 1080p/1440p, then parser null-Steam-ID audit, then ingest failure/empty-state tightening
- `Position Player` now uses bottom-locked labels in the canvas layer instead of the old opportunistic round chip behavior; the next pass should verify dense-fight readability and only then decide whether label scaling needs more tuning
- Live replay nametags should now follow the same core rule as the stronger prior art: full names, bottom-locked under the token, and no opportunistic top/bottom placement or ellipsis compaction in the live canvas path
- Utility review now jumps back into live replay with explicit player focus and utility focus preserved from the selected atlas entry; the next step is to QA that landing behavior across smoke / flash / HE / fire cases instead of reworking the jump path again
- Parser fallback identity for null Steam IDs has now been audited: current parser behavior is conservative rather than obviously corrupt because synthetic IDs stay keyed by `displayName + userID` and duplicate display-name risk is surfaced in `SourceDemo.Notes`; only revisit this if a real collapse/split case is reproduced from a demo, not as speculative cleanup
- Ingest UX is now being tightened at the real trust surface: parser-offline, ingest-failed, library-unavailable, and empty-library states should be explicit in Matches, and upload should stop presenting as available when `/api/health` is down
- Rebuild the replay right-rail roster toward a cleaner Skybox-style scan model by keeping parser-backed team/economy/utility truth, promoting each player's best available weapon as the primary visual anchor, adding image-led weapon treatment instead of text-only weapon labels, and compressing the remaining money / armor / utility info into a calmer secondary strip without dropping trustworthy information
- The current roster utility row is still the weakest scan point: the icons are boxed too tightly and read too small, so the next pass should make utility larger, less boxed-in, and easier to stack/read at a glance without removing real equipment truth
- The previous stacked utility experiment made the rail harder to scan across 1080p and 2K, so the current pass should return utility to one row, keep the icons larger, and tighten the right-rail shell instead of adding more vertical structure
- The replay shell still does not open in a clean "fit" state on 24-inch 1080p: the right rail and top analysis chrome remain too dominant, and the radar viewport is still reserving only generic padding instead of space that reflects the actual overlay footprint
- The next replay-shell pass should therefore combine shell sizing with viewport-fit tuning: keep utility on one readable horizontal row, reduce the default overlay budget on 1080p while scaling more gracefully on 1440p/2K/4K, and make the map fit the visible working area by default instead of sitting under the chrome
- Visual QA after the first fit pass showed the opposite failure mode: the map stopped being obstructed but became too small inside the workspace, so the next correction must back off the overly conservative top/right viewport padding and keep the overlay footprint tight enough that the map still feels dominant on 1080p
- The replay-shell root cause is now clearer: the roster was still behaving like an absolute overlay with no available-height contract, so the map viewport kept compensating with oversized padding; the next pass must make the roster a real right column with internal scrolling and then reduce the map's synthetic right-padding budget
- 1080p now needs to be treated as the explicit baseline target for the replay shell: the roster should fit both 5-player sections with no internal scroll at that height, and internal scrolling should only activate below a smaller-height threshold after vertical waste has been tightened out of cards, headers, gaps, and the bottom dock
- The current roster icon pass is using extracted CS2 equipment silhouettes only as a temporary private/internal reference path; do not treat those Valve assets as ship-ready for a public or subscription product, and replace them with repo-owned icons before productization
- The single full-height right roster remains the wrong unit even when it is technically responsive; the next pass should split CT and T into two separate compact roster surfaces on opposite sides of the map so 1080p/1440p scaling no longer depends on one sidebar dictating the whole replay shell
- The split roster architecture is better, but the first implementation still scrolls on normal desktop heights because the team panels are hard-capped too low and default to internal scrolling; the next pass should let the split team units size to content by default and only introduce panel height caps + internal scroll below the smaller-height threshold
- The next split-roster issue is not just height; the panels are still vertically centered like floating overlays, which wastes a lot of usable viewport on 1080p while also making 2K feel oddly detached, so the next pass should top-anchor the CT/T units, tighten row metrics slightly, and lower the internal-scroll breakpoint so standard desktop browser viewports do not scroll
- With 1080p now treated as the baseline and scrolling pushed down to genuinely short heights, the next roster pass should only add a taller-screen expansion path so 1440p/4K breathe more naturally without changing the 1080p fit contract
- The next polish gap is consistency between the split team units and the analysis roster controls: CT/T replay panels should share one vertical anchor, and Utility Atlas thrower chips should use one deliberate row per team instead of the generic wrapping chip grid
- The analysis roster controls still need stricter separation by mode: Utility Atlas and Position Player compare should use their own compact single-row team-chip treatment instead of inheriting the generic wrapping chip layout, while the live replay split roster should keep its own fixed-height card treatment
- The non-live analysis selectors now need to stay on their own dedicated component/CSS path: Utility / Paths / Player / Heatmap should all render the same one-row team strips, while the live replay roster keeps a fully separate layout contract
- Visual QA showed that truncation is still wrong for the analysis panel: Utility / Paths / Player / Heatmap need full readable names, so the fix is a wider non-live panel plus full-name one-row team strips instead of the old shared `replay-analysis-player-*` truncation path
- The analysis selectors still need to be literally identical across Utility / Paths / Player / Heatmap: one fixed one-row team strip per side, no compare-only scroll wrapper, and enough non-live panel width that the row treatment does not drift by mode
- Add a replay HUD above the map with in-game-style timer semantics and alive counts by extending canonical match timing with parser-backed `roundTimeSeconds` / `freezeTimeSeconds`, reusing bomb-flow truth for post-plant countdown, and then rendering one compact top strip instead of a viewer-guessed clock
- The local round-timer verification path is currently blocked by Windows Application Control on this machine: Vite's default `go run ./cmd/mastermind-api` child and the fallback `fixtureparse.exe` bridge path both fail to execute fresh parser binaries, so existing loaded replays can show freeze/bomb timers from canonical ticks but full live round countdown still needs a parser runtime path that can emit `match.roundTimeSeconds`
- Removed the temporary replay-inferred live round clock fallback after visual QA showed it emitting the wrong value (`1:12` instead of the expected `1:55`) on the user's current replay; until parser truth is restored, live round time should be omitted rather than guessed
- Fresh `/api/parse-demo` requests through the currently running Node bridge now do emit parser-backed `match.roundTimeSeconds`, so the remaining timer gap is stale stored replay data; re-uploading the same demo should refresh that match in place instead of creating a duplicate library row
- The replay HUD should read as three compact boxes above the map instead of one long strip, and the visible clock should follow in-game whole-second countdown semantics (`1:55`, not rounded-up `1:56`)
- Rebuild Matches toward a denser Skybox-inspired library rhythm by compressing top chrome, keeping played/uploaded time honest, replacing failed fake map-art experiments with simpler table-first map identity, and showing full visible team rosters instead of truncated player summaries
- Show dropped bomb truth on the replay map by reusing parser-backed `bombEvents` `drop` / `pickup` / `plant_*` flow, proving the staged fixtures already contain drop positions, and adding a persistent viewer-side ground marker only for the active dropped state instead of guessing from player badges
- Tighten dropped-bomb overlay truth across parser and viewer: the viewer now clears ground markers when `playerStreams.hasBomb` already shows a carrier, and the parser now reconciles carrier transitions into bomb pickup/drop events so `bombEvents` stop lagging behind sampled bomb-holder truth; the remaining bug is stale ground position between `drop` and `pickup`, so the next fix should add a parser-owned dropped-bomb position stream instead of anchoring the icon to the last `drop` event
- Replace the current short-lived red death cross with a quiet victim-team death marker that persists for the rest of the round, keeping the change strictly in the viewer render layer and grounded in canonical `round.killEvents`
- Fix local startup on this machine by removing the blocked `@vitejs/plugin-react-swc` runtime dependency from the dev path, then restart viewer + parser + Cloudflare tunnel and re-verify local `/api/health` plus the public URL
- Make the current fallback startup path a first-class one-command workflow instead of hidden operator knowledge, so this machine can reliably launch localhost with `npm.cmd run dev:bridge` while the Go child remains blocked

## Done
- Reduced docs clutter without changing product direction: shortened `README.md` into an entry doc that points to the runbook, updated `docs/README.md` so it reflects the current doc set including `docs/14-replay-v1-product-spec.md`, and archived the closed Claude review as historical context instead of leaving it mixed into active docs
- Ran bounded repo hygiene passes that removed root tmp/runtime logs, the temp Chrome profile, stale parser/viewer log artifacts, stray backup leftovers, and empty abandoned icon experiment folders; hardened `.gitignore` for local temp/profile/editor-backup leftovers while intentionally leaving active source work and currently needed local parser binaries untouched
- Stabilized local startup on this Windows machine: removed the blocked SWC dev path, switched `viewer` dev startup to `vite --configLoader runner`, formalized the Go-parser-vs-Node-bridge split in the runbook, added better startup logging, and verified `/api/health` against the active parser path
- Built the local friend-testing workflow end to end: same-origin `/api` dev proxying, Cloudflare quick-tunnel compatibility, feedback intake, usage telemetry, and memorable `friend-logs/` outputs for local observation
- Closed the Claude review follow-up work: shared parser player-ID derivation now backs `byInferno`, inferno event centering uses the active-fires-first path, bomb-time source plus duplicate synthetic-name warnings surface in parser notes, player-stream gap fills carry forward the last known sample, viewer stream interpolation respects `sampleIntervalTicks`, demo ingest times out, and the schema validator rationale is documented
- Added `docs/14-replay-v1-product-spec.md` and refreshed the status/roadmap docs so the 2D replayer stays the primary V1 product surface and future work stays replay-first instead of drifting back to Stats
- Shipped replay analysis as a real workspace instead of a plain playback screen: `Utility Atlas`, `Positions`, `Heatmap`, and `Position Player` all run off canonical parser truth, use the normal replay timeline as the transport, and were repeatedly tightened around side-aware filtering, selected-player study, and cleaner analysis controls
- Added tooling and validation around `Position Player`, role inference, parser semantics, and performance so feature work can be checked against staged fixtures and stable local baselines instead of visual guesswork
- Strengthened canonical replay fidelity across parser and viewer: yaw sanitization, inferno handling, bomb/kill/hurt positional checks, official-end sampling continuity, compact replay emission, parser module splits, and schema-backed replay validation all landed without weakening the canonical replay contract
- Built the local ingest flow from parser truth outward: parser CLI plus schema foundation, parser HTTP ingest, staged fixtures, local match library, persistent uploaded matches, parser-backed progress reporting, and replay loading all now sit on the canonical replay schema instead of browser-side demo parsing
- Reworked Matches from a basic upload list into a denser library surface with stronger row-open behavior, clearer map identity, better roster/result scanability, and parser-honest added-time semantics
- Rebuilt the replay workspace into a denser operator shell over multiple passes: slimmer navigation, tighter bottom dock, stronger map dominance, and a more deliberate analyst-console hierarchy without changing parser truth boundaries
- Added a real match stats destination, then iterated it toward a denser premium analysis surface with parser-backed tables, compact round breakdowns, conservative approximate metrics, and placement-aware role notes without inventing unsupported replay truth
- Added durable repo guidance outside chat history: specialist guides, `docs/12-product-surface-principles.md`, `docs/13-advanced-stats-v1.md`, parser/viewer performance baselines, and the current runbook all now capture repeatable rules, product direction, and regression checks
- Removed the experimental internal AI operations surface after it proved too distracting and too weakly tied to the replay-first product direction
- Preserved stored match row IDs during IndexedDB hydration so deleting older persisted library rows no longer risks orphaned records returning after reload

## Blocked
- Visual truth-checking still needs screenshots or side-by-side demo review
- Automated headless measurement of the replay dock's rendered height is blocked locally by browser permission failures, so exact before/after pixel verification still needs a working browser automation path or a live browser measurement hook

