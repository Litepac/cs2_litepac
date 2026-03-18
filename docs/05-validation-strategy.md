# 05 Validation Strategy

## Validation Goal

Only ship replay artifacts that are defensible enough for a trustworthy 2D viewer.

## Validation Layers

### 1. Structural Validation

Validate every emitted replay against `schema/mastermind.replay.schema.json`.

This catches:

- missing required fields
- wrong field types
- invalid enums
- unexpected shape drift between parser and viewer

### 2. Semantic Validation

Run replay-specific invariants, including:

- rounds are strictly ordered
- round ticks do not overlap
- scores progress monotonically
- kill ticks fall inside a round
- bomb events follow a legal sequence
- utility trajectories stay within declared lifetimes
- player sample arrays have aligned lengths

### 3. Golden Demo Regression Tests

Maintain a small curated set of real demos in `testdata/demos/`.

For each fixture:

- parse the demo
- compare the emitted replay against a reviewed golden replay
- allow diffs only when the parser change is intentional and reviewed

### 4. Map Calibration Validation

For each supported map:

- verify known anchor points land in expected radar locations
- verify spawns appear on the correct half
- verify bombsites render in the correct map zones

This protects against a visually plausible but wrong replay.

### 5. Viewer Acceptance Validation

Only after parser validation passes:

- confirm player markers move on the correct lanes
- confirm kill moments line up with positions
- confirm bomb plant and defuse markers appear at the right sites
- confirm smoke and fire windows match the timeline

## Review Gates

### Gate A: Parser correctness

No viewer feature work proceeds on a demo until:

- round boundaries are trusted
- positions are trusted
- core event timelines are trusted

### Gate B: Schema stability

Schema changes require:

- schema file update
- doc update
- parser update
- viewer update
- golden replay review

### Gate C: Uncertainty handling

If the parser cannot defend a field:

- set it to `null`, or
- omit it, or
- drop the affected viewer element entirely

We do not backfill uncertainty with guesses.

## V1 Acceptance Checklist

V1 is acceptable only when all of these hold on real demos:

- rounds load correctly
- kills align with round state
- bomb events align with round state
- utility appears on the map at the right times
- player markers are placed correctly on the map
- playback timing stays consistent through a round
- switching rounds does not leak state from the previous round
- selecting a player highlights the correct entity
