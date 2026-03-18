# 01 Project Structure

## Decision

Use a small two-part repository:

- A Go parser pipeline that reads `.dem` files and emits `mastermind.replay.json`
- A TypeScript viewer that reads only `mastermind.replay.json` plus static map assets

## Recommended Stack

### Parser

- Language: Go
- Demo parsing library: `demoinfocs-golang` v5
- Output: canonical JSON replay artifact

### Viewer

- Language: TypeScript
- UI shell: React
- 2D rendering: PixiJS
- Tooling: Vite

### Shared Contract

- Canonical artifact: `mastermind.replay.json`
- Machine-readable schema: `schema/mastermind.replay.schema.json`
- Static map metadata: separate versioned files under `assets/maps/`

## Why This Stack

### Why Go for the parser core

`demoinfocs-golang` describes itself as a "feature complete" and "production ready" CS2 parser, which is the strongest fit for a correctness-first replay core. It also exposes an event-driven parse model that maps cleanly to a deterministic normalization pipeline.

Not chosen:

- `awpy` is useful for analysis and visualization, but its own documentation says demos can be troublesome and notes increased error rates in POV demos.
- `awpy` also states it now relies on `demoparser2` as a backend.
- `demoparser2` is promising and Rust-backed, but its query-oriented API is a weaker fit for a parser-first architecture where we want explicit control over round reconstruction, event ordering, and validation gates.

That last point is an inference based on project goals and library interfaces, not a claim from the upstream projects.

### Why React plus PixiJS for the viewer

PixiJS positions itself as a fast and flexible 2D WebGL renderer, which matches a replay viewer with many moving entities on a static map. React is only for application state and controls; PixiJS owns actual replay rendering. This keeps rendering logic isolated from UI logic.

### Why Vite

Vite is current, simple, and keeps the frontend setup small. It is a tooling choice, not an architectural dependency.

## Proposed Repository Layout

```text
docs/
  01-project-structure.md
  02-replay-schema.md
  03-parser-pipeline.md
  04-viewer-scope.md
  05-validation-strategy.md

schema/
  mastermind.replay.schema.json

parser/
  cmd/
    mastermind/
  internal/
    demo/
    rounds/
    events/
    positions/
    utility/
    replay/
    maps/
    validate/

viewer/
  src/
    app/
    replay/
    canvas/
    controls/
    timeline/
    maps/
    selection/

assets/
  maps/
    <map-name>/
      radar.png
      calibration.json

testdata/
  demos/
  replays/
  goldens/
  map-calibration/
```

## Structure Rules

- `parser/` never imports `viewer/`
- `viewer/` never reads raw `.dem` files
- `schema/` is the contract boundary between parser and viewer
- `assets/maps/` contains static calibration data, not match data
- `testdata/` holds real fixtures and golden outputs only
- No god-packages and no mixed parser/viewer logic files

## References

- `demoinfocs-golang`: <https://github.com/markus-wa/demoinfocs-golang>
- `awpy`: <https://github.com/pnxenopoulos/awpy>
- `demoparser2`: <https://github.com/RPSam/demoparser2>
- PixiJS: <https://pixijs.com/>
- React: <https://react.dev/>
- Vite: <https://vite.dev/>
