# Current Status

## Goal
Build a trustworthy CS2 2D replay core with an operator-grade Replay workspace and a dense Stats surface, but keep parser truth ahead of presentation.

## Canonical Contract
- Parser emits one artifact: `mastermind.replay.json`
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

## Next High-Value Steps
- Make `Position Player` a genuinely useful selected-player cross-round movement tool without mixing it into Position Paths or replacing the normal replay timeline
- Add focused fixture/test coverage for replay-analysis snapshot correctness and click-to-round jumps
- Prune stale planning/doc drift so future chats follow the current parser-startup and replay-analysis path
- Continue map-by-map role-label validation only from parser-backed staged fixtures

## Source Of Truth
- Use `plans.md` for current execution status
- Use `docs/14-replay-v1-product-spec.md` for the replayer-first V1 product shape and current Replay gap audit
- Use the numbered docs for architecture and contracts
- Use this file for the current implementation state and immediate viewer direction
