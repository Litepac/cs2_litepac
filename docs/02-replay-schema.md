# 02 Replay Schema

## Canonical Artifact

The only replay artifact consumed by the viewer is:

- `mastermind.replay.json`

Rules:

- It is the single canonical replay format for V1
- The viewer must not read raw `.dem` files
- If a value is uncertain, it is omitted or set to `null`
- No speculative or derived performance stats belong in this artifact
- All timelines use absolute demo ticks

Machine-readable draft schema:

- `schema/mastermind.replay.schema.json`

## Schema Design Principles

### 1. Trust correctness over compactness

V1 stores player position streams in explicit per-player arrays with one sample interval definition. This is not the smallest possible representation, but it avoids hidden interpolation assumptions inside the artifact format.

### 2. Keep parser and viewer loosely coupled

The artifact contains replay facts, not rendering commands. The viewer decides how to draw a player, smoke, or bomb marker.

### 3. Make round semantics first-class

Rounds are explicit objects with start, freeze end, and end ticks. Side swaps are represented per round, not guessed in the viewer.

### 4. Use stable identifiers

- `teamId` identifies the real team
- `playerId` identifies the player across the match
- `utilityId` identifies a grenade or utility entity within a round

## Top-Level Shape

```json
{
  "format": "mastermind.replay",
  "schemaVersion": "1.0.0-draft",
  "generatedAt": "2026-03-14T20:00:00Z",
  "generator": {
    "name": "mastermind-parser",
    "version": "0.1.0"
  },
  "sourceDemo": {},
  "match": {},
  "map": {},
  "teams": [],
  "players": [],
  "rounds": []
}
```

## Required Domain Objects

### `sourceDemo`

Immutable facts about the input demo:

- original filename
- SHA-256 fingerprint
- tick rate
- demo tick count
- optional parser notes about partial support

### `map`

Static match map identity plus calibration reference:

- map id
- display name
- radar image key
- world-to-radar bounds
- rotation metadata if needed

### `teams`

Stable team identity:

- `teamId`
- display name
- optional clan name

### `players`

Stable player identity:

- `playerId`
- display name
- optional `steamId`
- `teamId`

### `match`

Match-level timing and identity facts:

- optional `matchId`
- `tickRate`
- `totalRounds`
- optional `gameMode`
- optional `bombTimeSeconds` when the parser can read the planted C4 timer from game rules

### `rounds`

Each round contains:

- round number
- score before and after the round
- round boundary ticks
- winner side and end reason if confidently known
- per-player side assignment and position stream
- fire events
- hurt events
- kill events
- bomb events
- utility lifecycles

## Position Stream Model

V1 uses per-player parallel arrays inside each round.

Example:

```json
{
  "playerId": "player-s1mple",
  "side": "CT",
  "sampleOriginTick": 12345,
  "sampleIntervalTicks": 1,
  "x": [12.4, 13.0, 13.7],
  "y": [-411.2, -409.5, -407.0],
  "z": [64.0, 64.0, 64.0],
  "yaw": [90.0, 91.5, 95.2],
  "alive": [true, true, true],
  "hasBomb": [false, false, false]
}
```

Invariants:

- all arrays have the same length
- samples are sorted by tick
- `sampleIntervalTicks` is `1` in V1
- values may be `null` when the parser cannot trust them

## Event Model

### Weapon Fire

Weapon fire is stored as a discrete event stream:

- tick
- shooter id if known
- weapon name
- shooter position if known

This is intentionally narrower than a bullet or hit model. It tells the viewer that a player fired at a tick, without guessing bullet path, recoil, or impact semantics.

### Hurt

Hurt events are stored separately from kills:

- tick
- attacker id if known
- victim id if known
- weapon name
- health damage taken
- armor damage taken
- attacker and victim positions if known

This gives the viewer a trustworthy way to show combat connections and damage numbers without guessing from HP deltas alone.

### Kills

Kills are discrete events with only fields we can validate directly:

- tick
- killer id if known
- victim id
- assister id if known
- weapon name
- headshot flag
- wallbang penetration count if known
- positions if known

### Bomb

Bomb events cover:

- pickup
- drop
- plant start
- planted
- defuse start
- defuse abort
- defused
- exploded

### Utility

Each utility object covers its lifecycle:

- `utilityId`
- kind: smoke, flashbang, hegrenade, molotov, incendiary, decoy
- thrower id if known
- start tick
- detonate tick if applicable
- end tick if applicable
- sampled trajectory
- phase events such as bounce, detonate, expire

This gives the viewer enough data to render grenade travel plus active smoke or fire windows without touching raw demo state.

## Explicit Non-Goals for V1 Schema

The canonical artifact does not include:

- ADR, KAST, rating, opening duel tags, clutch tags
- economy curves or buy classifications
- visibility inference
- line-of-sight probability
- guessed bomb site names when not confirmed

## Reference

- Schema file: `schema/mastermind.replay.schema.json`
