# plans.md

Planning note:
- `In Progress` means actively being worked now, not historically related.
- Paused or later work stays in `Planned` under `On Hold / Later`.
- `Done` should reflect what actually landed, not superseded intermediate versions.

## Planned
### Next Up
- Tighten ingest failure handling and empty-state guidance now that parser-backed round progress and the demo-only local match flow are in place
- Continue live visual QA against staged fixtures at 1080p and 1440p/2K
- Add fixture/integration coverage around parser-to-viewer ingest flow once the current product surfaces settle

### On Hold / Later
- Tighten parser edge cases found during visual replay checks
- Add canonical inferno footprint truth if future UI needs more than soft center-based fire rendering
- Add map calibration spot checks tied to known landmarks
- Reduce viewer bundle size and split heavy Pixi code paths
- Improve utility lifecycle fidelity after visual validation
- Tighten canonical replay fields where UI quality is blocked by missing trustworthy render data
- Consider a later Figma refinement loop for Home, Matches, shell consistency, and state polish once the product structure is stable enough for design refinement instead of active workflow churn
- Revisit a separate internal AI runtime surface only if direct VSCode/Codex integration becomes valuable enough to justify a true runtime-first sidecar instead of another staged prototype

## In Progress
- Finish the replay bottom area with one tightly scoped geometry/readability pass so the dock feels unified, compact, and clearly separated from the round strip without regressing map space
- Polish the new match stats destination into a stronger premium analytical surface while keeping it table-first and limited to trustworthy parser-backed stats
- Reconcile intentional post-round sampling through `officialEndTick` with round/stream validation so parser truth stays internally consistent
- Make bomb timer/state fully parser-owned and event-backed so planted countdown truth no longer depends on fragile parse-end state or inference

## Done
- Proposed clean project structure and stack direction
- Defined canonical `mastermind.replay.json` replay schema
- Added machine-readable schema draft
- Defined parser pipeline
- Defined minimal V1 viewer scope
- Defined validation strategy
- Scaffolded parser and viewer workspaces
- Implemented canonical replay types and schema validation hooks
- Implemented parser CLI with round, kill, bomb, utility, and position extraction paths
- Added map radar assets and calibration files
- Implemented viewer file loading, schema validation, round switching, playback, selection, and map rendering foundation
- Parsed real local demo fixtures into canonical replay artifacts
- Added fixture batch parsing and replay regression tests
- Added replay manifest expectations for current real-demo outputs
- Added fixture staging for direct viewer loading
- Fixed viewer bootstrap/schema issues and map asset loading
- Reworked viewer into a three-zone replay workstation layout with live roster and round timeline
- Added real on-map labels for all alive players with selected-player emphasis
- Added real utility lifecycle helpers for stage timing and HUD counts
- Added utility timelines and event ribbons driven by real replay utility data
- Added utility trajectories, phase markers, and safer path filtering for the map
- Added current implementation status documentation under `docs`
- Added viewer roadmap documentation under `docs`
- Added full-round utility path visibility and a cleaner dock/rail pass
- Added an agent/debug continuation runbook under `docs`
- Fixed utility trajectory rendering for sparse sampled grenade paths and removed untrusted player aim lines
- Added utility focus mode so map, HUD, and timeline can isolate smoke/flash/HE/fire/decoy validation
- Added per-frame projectile trajectory sampling in the parser and faster post-throw trail fade in the viewer
- Added smoke-focused path smoothing and richer smoke cloud rendering while keeping utility-family focus mode
- Added a shared playback clock and a smoke-specific render path to isolate utility flight debugging from the generic utility renderer
- Added prior-art architecture review under `docs/10-prior-art-review.md`
- Added repo-local specialist guides under `.github/agents/`
- Updated top-level `AGENTS.md` to reference specialist guides and the canonical replay boundary
- Added `.github/agents/ui-ux-specialist.md` and tightened docs around the reference-locked shell rebuild
- Added parser-backed live player equipment state to the canonical replay schema and parser streams
- Added parser-owned `activeWeaponClass` so viewer token mode no longer infers weapon class from weapon-name strings
- Added canonical `blindEvents` so flashed-player rings can use real flash duration/end ticks instead of guessing from flash detonation blooms
- Added parser-backed main-weapon and utility inventory state to canonical player streams and the viewer right rail
- Added parser-backed weapon-fire events to canonical rounds and restrained viewer shot cues on the map and timeline
- Added parser-backed hurt events so map combat cues can use attacker-victim truth and damage values
- Made fixture loading cache-safe and reduced schema validation walls to concise viewer errors
- Added `docs/11-agents-overview.md` to explain the agent system and how specialist guides connect to repo workflow
- Defaulted utility focus back to `All` and added a larger seek bar, 15-second dock markers, and a freeze-time toggle to the replay dock
- Normalized parser-side utility lifetime clamping to the real demo tick rate instead of a fixed `64`
- Expired infernos from active fire state so canonical replay can reflect real smoke-extinguish shutdown behavior
- Normalized inferno timer-ring presentation to full expected lifetime so smoke-extinguished fires still start full and only disappear early on canonical inferno expiry
- Increased flash detonation bloom opacity and linger so the parser-backed pop lumen reads more clearly at normal playback speed without changing flashed-player ring semantics
- Reworked smoke cloud rendering into a softer, more cohesive mass so parser-backed smokes read closer to the Skybox reference instead of stacked white puffs
- Added parser-backed smoke displacement events from HE overlap and viewer-side temporary smoke openings so HE can pop smokes without map-layer guesswork
- Slowed HE smoke-displacement recovery in parser duration and viewer easing so popped smoke openings refill gradually instead of snapping back after a brief cutout
- Fixed large-fixture staging by streaming replay copies into `assets/fixtures` instead of buffering huge files in memory
- Centralized utility presentation so rail, timeline, and map icons/colors use one shared kind-normalization and palette path
- Corrected map projectile utility icons toward Skybox-style side-colored silhouettes instead of pale ring markers, while keeping held utility on player tokens as the small forward dot
- Refactored `viewer/src/canvas/ReplayStage.tsx` into smaller stage bootstrap, camera, map, frame, player, bomb, and combat helper modules without changing the replay contract
- Refactored `viewer/src/app/App.tsx` into smaller replay-loading, playback, fixture, and timeline helper modules without changing runtime behavior
- Re-prioritized parser-side yaw validation as the next replay-truth follow-up after the current bomb/CI/parser-structure pass, based on bounded parser exploration
- Tightened parser-backed bomb overlays toward a calmer segmented planted/defuse read without changing bomb semantics
- Added minimal GitHub Actions CI for parser tests and viewer build, and ignored the local `parser/fixtureparse.exe` helper binary
- Split `parser/internal/demo/parser.go` into smaller metadata, round, combat, bomb, utility, frame-sampling, entity, and output modules without changing the canonical replay contract
- Added parser-side yaw sanitization, semantic validation, and fixture-backed yaw coverage checks so facing cues can omit untrusted direction instead of guessing
- Tightened viewer yaw interpolation so null parser yaw no longer bleeds across neighboring frames, and softened the bomb-core fill toward the Skybox reference
- Corrected yaw validation to omit invalid/out-of-range parser yaw instead of normalizing it, replaced brittle coverage thresholds with invariant and synthetic validation tests, and moved bomb overlays above smoke/utility cover
- Tightened player-token readability with cleaner non-selected facing marks and a more tucked utility badge, and flattened the bottom dock styling toward a calmer single-panel read
- Added parser-side bomb/kill/hurt positional completeness checks and bomb-site shape validation, plus fixture-backed tripwires for current replay outputs
- Continued player sampling and viewer rendering through official round end so post-defuse/post-explode movement no longer freezes while the timeline advances, and normalized the displayed round index to start at 1 for the first loaded round
- Switched canonical replay emission from pretty-printed to compact JSON so large staged fixtures stay below browser JS string limits and `test1-3` can load again without schema changes
- Reconciled the `officialEndTick` post-round render window with parser validation and schema docs, and backfilled observed official-end tails when demos omit an explicit official-end event so player-stream bounds stay canonical
- Added a local parser HTTP ingest surface for `.dem` upload plus a stronger viewer entry state, so raw demos can be uploaded from the page while canonical replay generation still stays outside the browser runtime
- Turned parser-backed `.dem` and replay upload into a local matches page that lists uploads by map, added date, teams, and score instead of exposing raw demo filenames before opening the replay workspace
- Split the no-replay shell into a welcoming Home surface and a dedicated Matches page in the left rail, so navigation, upload, library browsing, and replay viewing now live on clearer product surfaces
- Narrowed the public ingest path to `.dem` uploads, added a truthful demo ingest tracker with round indexing, and persisted local uploaded matches across reloads using browser-side storage
- Streamed parser-backed round-finalized progress through the local ingest API so the matches-page demo tracker can light up real rounds during parsing instead of only animating at the end
- Tightened the repo-local UI and frontend specialist guides with a stronger premium-product-shell bar, required state handling, and an explicit anti-dashboard stance without weakening parser-first truth rules
- Added repo-local `skills/frontend-ship/SKILL.md` so future product-shell UI work can reuse a concise ship-ready frontend workflow without weakening parser-first truth rules
- Added a compact UI quality bar to root `AGENTS.md` so premium, non-dashboard, state-complete frontend expectations apply repo-wide before specialist guides are loaded
- Applied the repo-local `frontend-ship` workflow to Home and Matches so the first viewport is more deliberate: welcome on Home, ingest desk plus library hierarchy on Matches, fixtures demoted, and focus states made explicit
- Reworked Home and Matches again toward a stronger left-anchored composition with fewer repeated cards: Home now uses one hero plus one product-flow frame, and Matches uses a clearer ingest desk, helper band, and library-first hierarchy
- Redesigned Home and Matches toward a more sellable product shell: narrower rail, stronger hero/product-frame composition on Home, upload integrated directly into the Matches header, cleaner match-row scan rhythm, and less boxy dashboard drift overall
- Pushed Home and Matches into a materially stronger second-pass shell redesign: real two-column Home hero with live local-state anchoring, Matches rebuilt as an ingest-to-library workspace with the library dominating and fixtures demoted to a secondary rail, and the sidebar visually reduced so the product surface owns the viewport
- Rebuilt Home into a bolder cyberpunk-inspired in-app landing shell with a text-led hero, integrated product-preview frame, reduced rail dominance, and a more sellable first viewport without changing the parser-first local workflow
- Shifted Home to a slim top-navigation shell instead of the left rail so branded landing surfaces can breathe, while Matches/replay keep denser navigation patterns where the operational value is higher
- Tightened Home with a final art-direction pass: integrated the grid/background more naturally across the full hero scene, gave the “THE ROUND” line a subtler premium internal treatment, and tuned larger-screen scale without changing the page concept

- Rebuilt Matches into a top-nav, library-first product surface so the match library dominates immediately, upload reads as a compact page action instead of a workflow block, and fixtures/dev validation are pushed into a clearly secondary collapsible section
- Rebuilt the replay workspace into a denser operator console with a slimmer replay-specific tool rail, stronger map dominance, tighter right-rail and bottom-dock treatment, and a more purpose-built review-shell hierarchy without changing team color semantics, round navigation, or replay-control purpose
- Compressed the replay workspace again into a tighter analyst console with a materially narrower left tool rail, lighter recent-match treatment, and a more unified bottom replay dock so the map regains more width without changing the replay information model
- Fixed replay-workspace nav regression by making Home and Matches exit the replay shell correctly, rebuilt the left side into a slim global rail plus compact replay-context module, and loosened map fit/zoom-out so tactical overview is easier without changing the right-side team panel model
- Rebalanced the replay left side into a compact but readable two-part tool rail with a slim global nav strip, a clearer replay-context panel, larger click targets, and more comfortable type so it reads like a premium workspace menu instead of a tiny debug rail
- Stripped the replay left side down to a pure navigation rail with only brand plus Home/Matches/Stats navigation, so the workspace menu no longer competes with the map or behaves like a metadata sidebar
- Rebuilt the replay bottom area into a materially flatter transport bar by removing the separate readout band, flattening right-side controls into the main timeline row, and shrinking the round strip, seek stack, and utility row so the map regains clear vertical space without sacrificing replay controls or readable labels
- Restored the post-reset upload fixes: trimmed streamed replay results back to valid NDJSON and stopped local Matches rows from collapsing onto a single SHA-only library entry
- Added a compact delete action to the Matches library and wired it through local browser storage so uploaded demos can be removed cleanly from the library
- Restored replay-dock readability by increasing round/text/control legibility without returning to the old tall panel layout
- Added a real match stats destination with parser-backed sortable team tables and a compact rounds breakdown, wired from the Matches library without inventing role or HLTV rating data
- Ran a repo sanity sweep, pruned stale active-work items in `plans.md`, and folded root temp-log cleanup into normal repo hygiene
- Removed the experimental internal AI operations surface from the active repo path after multiple prototypes proved too distracting and too weakly connected to real VSCode/Codex work for the project's current stage
- Preserved stored match row IDs during IndexedDB hydration so deleting older persisted library rows no longer risks leaving orphaned records that reappear after reload
- Added a first parser performance scaffold under `parser/internal/validate/performance_bench_test.go` and `docs/perf/README.md` so future regression checks can use replay validation benchmarks, profiles, and viewer trace baselines instead of opinion, and verified that the benchmark package runs locally
- Captured and committed the first parser validation benchmark baseline under `docs/perf/benchmarks/2026-03-28-parser-validate-benchmark.txt`, and added a fixed viewer trace runbook under `docs/perf/traces/README.md`
- Captured the first viewer replay trace baseline under `docs/perf/traces/2026-03-28-replay-trace-baseline.json` so replay/timeline changes can be compared against a real Chrome performance trace instead of visual feel alone
- Tightened the replay dock geometry again by moving score/speed/reset out of the main transport row and into the support strip so the timeline lane owns more horizontal width without changing the replay information model

## Blocked
- Visual truth-checking still needs screenshots or side-by-side demo review
- Automated headless measurement of the replay dock's rendered height is blocked locally by browser permission failures, so exact before/after pixel verification still needs a working browser automation path or a live browser measurement hook
