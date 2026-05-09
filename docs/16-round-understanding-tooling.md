# Round Understanding Tooling

## Product Thesis
DemoRead should become a round-understanding tool, not just another 2D demo viewer.

The product promise is:

> Replay less. Understand more.

Every analytical surface should answer a concrete review question and jump back into the canonical live replay when the user wants proof.

## Current Baseline
The current replay tabs are a good foundation:

- **Live**: inspect the current round state.
- **Utility**: review throws, paths, and landing/effect points.
- **Paths**: inspect movement routes across a round or round set.
- **Player**: study one selected player's timing and repeated positions.
- **Heatmap**: supporting occupancy/hotspot layer, not a primary workflow until user feedback proves a sharper job.

These mostly answer "what happened?". The next product layer should answer "why did it matter?".

## High-Value Tool Families

### 1. Contextual Review Inspector
Add one shared inspector surface that changes based on what the user clicked:

- death marker
- kill timeline event
- utility marker
- player marker
- position snapshot
- round/timeline marker

The inspector should show parser-backed facts first, then omit uncertain claims.

Do not start with broad AI text. Start with precise evidence cards.

### 2. Death Autopsy
Clicking a death should answer:

- Who killed whom?
- Where and when did it happen?
- What did the victim do in the last few seconds?
- Was the victim flashed or recently damaged?
- Was a teammate close enough to trade?
- Did a trade happen quickly after the death?
- Did the victim die with important utility unused?

Safe labels:

- `Traded`
- `Untraded`
- `Likely isolated`
- `Recently flashed`
- `Died with utility`
- `Unknown`

Avoid stronger labels like `bad death`, `bait`, or `wrong peek` until a defensible model exists.

### 3. Trade And Spacing Review
For each duel/death, measure teammate support:

- nearest teammate distance
- teammate line/timing to victim area
- time until trade kill, if any
- whether the dead player was separated from the pack

This is likely one of the strongest individual-improvement tools because it turns a death into spacing evidence.

### 4. Round Swing Timeline
Extend the current event timeline into a round-story strip.

Start only with parser-backed swing candidates:

- first damage
- opening kill
- fast trade or untraded opening death
- bomb plant / defuse / explode
- bomb carrier death / bomb drop
- utility before kill/death
- player death with high remaining utility

Avoid win-probability percentages and hard "momentum" claims until a real model exists.

### 5. Utility Impact Review
Utility should eventually answer whether a throw mattered.

Parser-backed first pass:

- flash victims and teammate blinds, if available
- HE damage and follow-up kill timing
- fire active window and whether enemies crossed/held nearby
- smoke active window and whether contact happened before or after it faded
- utility thrown shortly before a kill, death, plant, or execute contact

Safe labels:

- `Blinded enemy`
- `Team flash`
- `Damage before duel`
- `No follow-up seen`
- `Unknown impact`

Avoid "good smoke" or "wasted utility" unless the required sightline/space model exists.

### 6. Timing Review
Timing tools should use shared round-clock anchors:

- first contact time
- first utility time
- first damage / opening kill time
- bomb plant timing
- rotate arrival timing when player movement makes it defendable
- selected-player position at the same round clock across rounds

This should build on the existing `Player` and `Paths` modes rather than become an unrelated dashboard.

### 7. Round Finder / Review Queue
Before adding more map overlays, make it easy to find the right rounds:

- side
- round result
- pistol/force/full-buy when economy truth is trustworthy
- opening death by player
- bomb plant / defuse / explode
- clutch
- player died with utility
- untraded opening death
- utility type used

Round Finder should create a review queue and jump into Live replay.

## Space Control Caution
Space control is promising but risky.

A true control overlay needs a defendable model for:

- player positions
- deaths
- known vs unknown information
- utility blockers
- timing of contact
- bomb visibility
- map areas and sightlines

Start with simpler evidence such as presence zones, recent deaths, bomb events, and utility-denied lanes. Do not label areas as controlled/contested unless the model is explicit and tested.

## Heatmap Position
Do not spend more iteration budget on broad movement heatmaps until user feedback proves a clear job.

If Heatmap continues, split it into narrow modes:

- death heatmap
- kill heatmap
- first-contact heatmap
- selected-player dwell heatmap
- lost-round death heatmap

Broad "where everyone moved" heatmaps have been visually unstable and analytically weak in current review.

## Recommended Build Order
1. Add the contextual Review Inspector state and shell.
2. Implement Death Autopsy using current kill/death/player-stream/utility facts.
3. Add trade/spacing measurements around deaths.
4. Add Round Swing Timeline markers from safe parser-backed events.
5. Add Utility Impact cards only where parser truth already supports impact.
6. Add Round Finder / Review Queue once the first analysis cards exist.
7. Revisit Heatmap only after external user feedback.

## Non-Negotiables
- Parser and canonical replay own truth.
- Viewer may measure and present existing truth, but should not invent tactical conclusions.
- If a label sounds like coaching, make sure it is backed by explicit data or replace it with `Unknown`.
- Every card should include enough evidence to let the user verify the claim in the replay.
