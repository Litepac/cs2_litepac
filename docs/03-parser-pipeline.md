# 03 Parser Pipeline

## Pipeline Goal

Convert a real `.dem` into a validated `mastermind.replay.json` with no viewer-specific shortcuts.

## Pipeline Stages

### 1. Intake

Input:

- local `.dem` path

Output:

- source demo metadata
- file fingerprint
- parser run metadata

Checks:

- file exists
- readable
- fingerprint computed before parse

### 2. Raw Demo Decode

Use `demoinfocs-golang` to read:

- match header
- player identities
- round events
- kill events
- bomb events
- utility entity events
- player positions on each tick

Raw parser output is still not trusted as canonical output.

### 3. Round Reconstruction

Build an internal round timeline:

- round start
- freeze end
- live phase
- round end
- official end if distinct

This stage owns tricky reconciliation such as:

- side swaps
- overtime continuation
- reconnects
- missing or duplicated round markers

If round boundaries cannot be trusted, the affected round is flagged and omitted from viewer consumption rather than guessed.

### 4. Event Normalization

Normalize raw parser events into internal domain models:

- `KillEvent`
- `BombEvent`
- `UtilityLifecycle`
- `PlayerRoundStream`

Rules:

- assign stable ids
- convert parser enums into our enums
- drop uncertain derived fields
- preserve absolute ticks

### 5. Map Calibration Attachment

Attach static map metadata from `assets/maps/<map>/calibration.json`:

- radar image key
- world bounds
- transform metadata

This is where world coordinates become renderable map coordinates later, but the parser still emits world-space facts in the replay artifact.

### 6. Validation Gate

Run structural and semantic validation before writing output:

- schema conformance
- sorted ticks
- no round overlap
- no kill outside round bounds
- no trajectory outside utility lifetime
- no player stream shorter than required for its declared sample count

Any hard failure blocks artifact generation.

### 7. Emit Canonical Replay

Write:

- `mastermind.replay.json`

Optional side artifacts for developers only:

- validation report
- parse log

Those are not viewer inputs.

## Internal Parser Module Boundaries

```text
demo/       raw parser adapter
rounds/     round boundary reconstruction
events/     kills and bomb normalization
positions/  per-tick player extraction
utility/    grenade and area-effect lifecycle extraction
maps/       calibration lookup and transform metadata
replay/     canonical replay assembly
validate/   structural and semantic validation
```

## Important Policy Decisions

### Positions are parser-owned, not viewer-owned

The parser extracts real position streams. The viewer does not infer paths between sparse event points.

### Validation happens before viewer work

Viewer bugs are not fixed by hiding parser uncertainty. Parser output must be trustworthy before the viewer grows.

### Omit unknowns instead of guessing

If a field is not defensible, it is absent or `null`.
