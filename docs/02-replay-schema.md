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

`endTick` is the gameplay/result boundary for the round. `officialEndTick`, when present and later than `endTick`, marks the parser-backed post-result window where the round is effectively over but canonical player movement may still continue until the official transition. When demos do not surface an explicit official-end event, the parser may use the observed post-result tail it actually sampled before finalizing the round. That tail is a render/lifecycle window, not a replacement for round ordering, so it may extend beyond the next round's `startTick` in real fixtures.

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
- optional `roundTimeSeconds` when the parser can read round length from game rules
- optional `freezeTimeSeconds` when the parser can read freeze time from game rules
- optional `bombTimeSeconds` when the parser can read the planted C4 timer from game rules

### `rounds`

Each round contains:

- round number
- score before and after the round
- round boundary ticks
- winner side and end reason if confidently known
- per-player side assignment and position stream
- optional dropped-bomb ground position stream while the bomb is lying on the map uncarried
- blinded-player events
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
- streams must stay within the round window, extending through `officialEndTick` when that later post-result boundary is present
- values may be `null` when the parser cannot trust them

## Event Model

### Weapon Fire

Weapon fire is stored as a discrete event stream:

- tick
- shooter id if known
- weapon name
- shooter position if known

This is intentionally narrower than a bullet or hit model. It tells the viewer that a player fired at a tick, without guessing bullet path, recoil, or impact semantics.

### Blind

Blinding from flashbangs is stored as a discrete player event stream:

- tick
- flashed player id
- attacker id if known
- duration in ticks
- end tick

This lets the viewer render blinded-player indicators from canonical replay truth without inventing per-player screen-space whiteness from flash detonation blooms alone.

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

Rounds may also carry an optional `droppedBombStream` with sampled bomb world positions while the bomb is on the ground and not carried. This is separate from discrete bomb events because the bomb can still slide or settle between a `drop` and a later `pickup`, and the viewer should not have to infer that movement from one stale event position.

### Utility

Each utility object covers its lifecycle:

- `utilityId`
- kind: smoke, flashbang, hegrenade, molotov, incendiary, decoy
- thrower id if known
- start tick
- detonate tick if applicable
- end tick if applicable
- sampled trajectory
- phase events such as bounce, detonate, expire, and parser-derived smoke displacement windows
- optional sampled fire footprint for molotov/incendiary entities when the parser can read active inferno fire cells

This gives the viewer enough data to render grenade travel plus active smoke or fire windows without touching raw demo state.

Utility phase events may also carry an optional duration when the parser can express a short-lived interaction window directly. Current use:

- smoke `displaced` phases derived from overlapping HE detonation truth, so the viewer can open temporary holes in active smokes without inferring overlap from rendered pixels

## Player Equipment Semantics

Player streams also carry parser-owned active-equipment semantics so the viewer does not need to reverse-engineer token or rail state from human-readable weapon names:

- `activeWeapon`: active equipment display name such as `AK-47`, `HE Grenade`, or `Knife`
- `activeWeaponClass`: parser-owned coarse class such as `pistol`, `smg`, `heavy`, `rifle`, `sniper`, `knife`, `utility`, or `equipment`
- `mainWeapon`: parser-owned primary combat weapon display name when one exists

This keeps player token mode on the parser/canonical side of the boundary instead of letting map and roster UI reinterpret weapon strings independently. Exact held-grenade kind can still be derived in one shared viewer resolver from the already-canonical `activeWeapon` display name without duplicating another full per-tick semantic array.

## Explicit Non-Goals for V1 Schema

The canonical artifact does not include:

- ADR, KAST, rating, opening duel tags, clutch tags
- economy curves or buy classifications
- visibility inference
- line-of-sight probability
- guessed bomb site names when not confirmed

## Reference

- Schema file: `schema/mastermind.replay.schema.json`
