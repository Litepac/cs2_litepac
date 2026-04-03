# Viewer Trace Scenario

Use one fixed replay and one fixed interaction sequence so traces stay comparable.

## Fixture

- Use the same staged replay fixture for every baseline and comparison run.
- Prefer a replay that exercises:
  - round switching
  - normal playback
  - timeline scrubbing
  - visible utility and combat events

## Interaction Script

1. Open the replay workspace with the fixed fixture.
2. Start at the first loaded round.
3. Press play and let the replay run for 10 seconds.
4. Scrub from the current position to roughly the middle of the round.
5. Scrub again to roughly the final quarter of the round.
6. Toggle one replay filter if relevant, then return to the default state.
7. Stop the trace and export the JSON.

## Capture

- Open Chrome DevTools -> `Performance`
- Record the interaction sequence above
- Export the trace JSON into this folder for local comparison runs
- Trace JSON exports in this folder are ignored by git on purpose; if a baseline needs to be shared, commit a short summary file outside the ignored JSON glob

## Naming

- `YYYY-MM-DD-replay-trace-baseline.json`
- `YYYY-MM-DD-replay-trace-change-name.json`

## Rule

Do not compare traces from different fixtures or different interaction scripts.
