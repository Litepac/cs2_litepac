# Current Status

## Goal
Build a trustworthy CS2 2D replay core with a Skybox-like operator viewer, but keep correctness ahead of presentation.

## Canonical Contract
- Parser emits one artifact: `mastermind.replay.json`
- Viewer consumes only the canonical replay artifact
- No mock replay data in the core flow
- No speculative stats in the viewer

## Working State
- Real `.dem` fixtures are being parsed into canonical replay files
- Viewer loads staged replay fixtures directly
- Round switching, playback, player selection, and live roster are working
- Map rendering is stable again after rolling back unsafe crop/projection experiments
- Bomb, kill, utility, and player-position data are all being rendered from real replay output

## Viewer Progress
- Three-zone workstation layout is in place
- Bottom replay dock now includes:
  - round phases
  - kill markers
  - bomb markers
  - utility markers
  - utility active windows
- On-map player labels are live for all alive players
- Selected players get stronger emphasis and recent movement trails
- Utility rendering now includes:
  - smoke/fire/decoy lifecycle visuals
  - utility timers from real ticks
  - utility event ribbon entries
  - full-path throw trajectories
  - bounce/detonation phase markers

## Known Open Issues
- Player aim vectors still need visual truth-checking against demo reality
- Heavy fights can become visually dense due to labels, timers, and utility badges competing
- Utility trajectory styling is improved, but still needs comparison against the target visual language
- Parser-side utility lifecycle completeness still needs more truth-checking on real matches, especially fire/smoke edge cases

## Next High-Value Steps
- Verify and, if needed, correct player facing vectors against real demo playback
- Reduce on-map clutter while preserving trustworthy detail
- Continue refining utility trajectory readability toward the target reference
- Add parser-side spot checks tied to issues found during viewer truth-checking

## Source Of Truth
- Use `plans.md` for current execution status
- Use the numbered docs for architecture and contracts
- Use this file for the current implementation state and immediate viewer direction
