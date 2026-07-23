# Current Status

## Goal
Build a trustworthy CS2 2D replay core with an operator-grade Replay workspace and a dense Stats surface, but keep parser truth ahead of presentation.

## Canonical Contract
- Parser emits one artifact: `mastermind.replay.json`
- The current contract is `1.1.0-draft`; incompatible player-stream additions are versioned explicitly
- Viewer consumes only the canonical replay artifact
- No mock replay data in the core flow
- No speculative stats in the viewer

## Working State
- Real `.dem` files are parsed locally into canonical replay artifacts through the parser API
- Home is a branded entry surface, Matches is the local library, Replay is the operator workspace, and Stats is a match-analysis destination
- Replay round switching, playback, player selection, and the live roster are working from parser-backed player streams
- Utility Atlas, Heatmap, Position Paths, and Position Player exist as parser-backed replay-analysis modes
- Position Paths is broadly useful, Heatmap is supporting context, and Position Player is the active quality gap
- Position Player should be treated as selected-player timing/pattern study first; broad all-player comparison is only a secondary overview
- Map rendering, bomb events, utility events, combat events, and player positions are rendered from real replay output only
- Unknown numeric, angle, movement, and stance samples stay `null` through viewer interpolation
- Production is 2D-first; the experimental 3D renderer is development-only and Live-only

## Viewer Progress
- A top-nav Home / Matches shell and a denser Replay operator workspace are in place
- The Replay dock uses the normal transport timeline and includes:
  - round phases
  - kill markers
  - bomb markers
  - utility markers
  - utility active windows
- On-map player labels, team context, selected-player emphasis, and recent movement trails are live for the normal replayer
- Replay analysis overlays now include:
  - parser-backed utility throw routes and detonation markers
  - route-line views for movement paths
  - occupancy / player heatmaps
  - cross-round player-position snapshots
- Core utility rendering still includes:
  - smoke/fire/decoy lifecycle visuals
  - utility timers from real ticks
  - utility event ribbon entries
  - full-path throw trajectories
  - bounce/detonation phase markers

## Known Open Issues
- `Position Player` still needs stronger validation around selected-player isolation, round labels, token click jumps, snapshot/live alignment, and the explicit broad-compare fallback path
- Heavy fights can still become visually dense when labels, timers, and utility badges compete
- Stats role labels are parser-backed and placement-aware, but several maps still need fixture-backed tuning
- Parser-side utility lifecycle and post-round sampling remain valid follow-up areas if new fixture mismatches appear
- Schema validation is now bounded around compiled root/item envelopes: large typed player/trajectory sample arrays are checked in place instead of being expanded into a complete generic JSON tree. The 285 MB fresh replay passes the exact Go WebAssembly fixture gate in 37 seconds without exceeding the runtime's 4 GiB ceiling.
- CI has a committed canonical replay gate, but extraction still needs a newly recorded short offline bot-match `.dem` with explicit project-owned redistribution provenance. The current local demos are 307-523 MB, and no small upstream download with sufficiently clear demo-content provenance was identified.
- The friend-tunnel API has local safeguards but still lacks authentication, durable quotas, and distributed edge controls
- The development-only 3D stage remains too large internally and should be split before it returns to any release path

## Parser Compatibility Check (2026-07-23)
- [Valve's July 8 update](https://www.counter-strike.net/newsentry/701021228894257508?l=english) redesigned C4 damage around precomputed simulation values embedded in official compiled maps and a shockwave that expands from the explosion center. [The July 9 follow-up](https://www.counter-strike.net/newsentry/701021228894259656) corrected boundary damage, removed the map-wide minimum point of damage, and increased force on dropped weapons.
- The canonical `exploded` bomb event still provides a trustworthy tick and origin, but the replay does not own Valve's map-compiled, occlusion-aware shockwave field. The viewer therefore uses only a short screen-space explosion-event pulse and no longer draws guessed circular damage-radius bands.
- The fresh replay contains one explosion event and no hurt event explicitly classified with weapon name `C4`; that is insufficient evidence for reconstructing shockwave arrival or damage from player events.
- All ten installed official defusal-map VPKs inspected (`ancient`, `anubis`, `cache`, `dust2`, `inferno`, `mirage`, `nuke`, `overpass`, `train`, and `vertigo`) contain `maps/<map>/baked_bomb_damage.vdata_c`. The resource identifies itself as `CS2_BOMB_DAMAGE_DATA`, header version `1`, and decompiles into `bombsites`, `positions`, and `damage_values` binary blobs.
- The current Mirage resource has SHA-256 `AB848262CD263358D4568A7566E492450303D60980E1AAA47B98E07E6F4A7776`; its `positions` blob contains 68,177 packed 3D records and `damage_values` contains one 8-byte record per position. Source2Viewer exposes the blobs but does not decode their game semantics, so distance, arrival time, damage, and graph/occlusion meaning remain unknown.
- Any future canonical shockwave data must carry an exact map-resource fingerprint, not only `mapId`: the simulation is compiled into the map package and can change independently per map build. Extracted Valve resources remain local and must not be committed.
- The July 9 engine-code update also prompted parser compatibility to be rechecked with the newly supplied demo instead of inferred from old fixtures.
- The repo already pins [`demoinfocs-golang/v5 v5.2.0`](https://github.com/markus-wa/demoinfocs-golang/releases/tag/v5.2.0), which remains the latest tagged upstream release; no unverified pseudo-version upgrade was taken.
- The supplied 307,386,819-byte demo parses and validates as a 21-round Mirage replay with 153 kills, 112 bomb events, and 380 utility entities.
- The first pass exposed a local utility-correlation bug rather than a wire-format decoder failure: Source 2 reused an entity ID and an inferno was attached to a stale flashbang entry. Inferno ownership now prefers the library's stable inferno `UniqueID`, rejects stale or ineligible entity mappings, and has focused regressions for both non-fire and older active-fire reuse.
- The local replay manifest records the supplied demo SHA-256 and canonical summary. The source remains ignored because both the 202,737,756-byte compressed download and 307,386,819-byte demo are too large for normal Git, and redistribution provenance is not established.

## Next High-Value Steps
- Make `Position Player` a genuinely useful selected-player cross-round movement tool without mixing it into Position Paths or replacing the normal replay timeline
- Add focused fixture/test coverage for replay-analysis snapshot correctness and click-to-round jumps
- Add a license-safe compact `.dem` extraction fixture to CI
- Continue map-by-map role-label validation only from parser-backed staged fixtures

## Source Of Truth
- Use `plans.md` for current execution status
- Use `docs/14-replay-v1-product-spec.md` for the replayer-first V1 product shape and current Replay gap audit
- Use the numbered docs for architecture and contracts
- Use this file for the current implementation state and immediate viewer direction
