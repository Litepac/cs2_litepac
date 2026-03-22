# plans.md

Planning note:
- `In Progress` means actively being worked now, not historically related.
- Paused or later work stays in `Planned` under `On Hold / Later`.
- `Done` should reflect what actually landed, not superseded intermediate versions.

## Planned
### Next Up
- Finish player-token polish now that token mode is parser-backed through `activeWeaponClass`
- Tighten bomb overlay polish toward the Skybox reference, especially planted-ring/icon refinement
- Keep flattening and simplifying the bottom dock so it reads closer to one calm Skybox-style operator panel
- Continue live visual QA against staged fixtures at 1080p and 1440p/2K

### On Hold / Later
- Tighten parser edge cases found during visual replay checks
- Add parser-side yaw validation before relying more heavily on facing semantics
- Add canonical inferno footprint truth if future UI needs more than soft center-based fire rendering
- Add map calibration spot checks tied to known landmarks
- Reduce viewer bundle size and split heavy Pixi code paths
- Improve utility lifecycle fidelity after visual validation
- Add explicit parser-side spot checks for bomb and kill event positional completeness
- Tighten canonical replay fields where UI quality is blocked by missing trustworthy render data

## In Progress
- Refine parser-backed hurt-line combat cues so the map read feels intentional and Skybox-like without inventing bullet-path truth
- Improve bomb readability with parser-backed planted and defusing overlays, including a more Skybox-like segmented planted timer ring and defuse-abort truth so the viewer does not fake continuous defuse state
- Push the viewer shell, dock, rail, and utility presentation closer to the Skybox reference using only parser-backed replay truth
- Make HE-smoke displacement read as a temporary smoke hole with slower refill, not as a large HE-style overlay effect
- Align smoke closer to the Skybox-style canister-with-side-hardware reference and keep flash distinctly shorter/ringed so the shared icon family separates cleanly at map scale
- Tighten flash specifically toward the compact Skybox-style ringed canister silhouette before further utility-family polish
- Increase flash projectile render scale so the map icon reads closer to Skybox utility size instead of a tiny micro-glyph
- Increase HE and molotov projectile size tiers and sharpen their silhouettes so they stay readable beside the larger smoke/flash family
- Make held-utility player token markers utility-specific so the small attached marker shows which grenade is equipped instead of only signaling generic utility state
- Tighten held-utility token attachment so the original dot stays visible and the micro-icon sits in a fixed lower-right anchored slot closer to the Skybox reference
- Rebuild utility trajectory rendering so the line follows the live projectile path, disappears on pop, and uses parser-backed bounce events for the small impact circles
- Tighten the right rail toward a denser scoreboard-style hierarchy with cleaner weapon/vitals/utility balance
- Rebuild player token styling and utility visuals toward stronger operator readability without inventing live fire cues
- Visual validation workflow using staged local replay fixtures

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

## Blocked
- Visual truth-checking still needs screenshots or side-by-side demo review
