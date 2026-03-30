# Advanced Stats V1

## What shipped

The stats route now has a first real advanced analysis layer built from parser-backed replay truth.

Implemented areas:

- `Summary`
- `Duels`
- `Utility`
- `Roles / Style`
- `Advanced`

The current stats page still uses the same compact header + stacked scoreboard + round-matrix structure, but the tables can now switch between multiple data views instead of overloading one summary scoreboard.

The stats route was later simplified again so it gets to the data faster:

- no extra promo / explainer layer above the scoreboards
- calmer Summary table focused on first-read metrics
- less box-heavy slab framing and less visual competition across the row
- advanced tabs now work more like analysis lenses than mini-dashboard modules

There is also now a small local inspection helper for validating role outputs against staged fixtures:

- `tools/inspect-stats-roles.ts`

## Data audit

### Already available in replay truth

Grounded parser/viewer data already existed for:

- cross-team kill events
- assister data
- headshots
- blind events with attacker, victim, duration, and end tick
- hurt events with weapon names and damage
- bomb events with plant/defuse/explode and site
- utility entities with thrower and utility kind
- per-round player alive streams
- active weapon / main weapon streams
- side-specific per-round participation

This makes the following grounded derivations possible without parser changes:

- opening duel participation
- opening kills / opening deaths
- trade kills / traded deaths
- multi-kills
- utility damage totals
- HE damage
- fire damage
- enemies flashed
- blind time
- estimated flash assists
- grenade throws by family
- sniper kill share
- plants / defuses
- clutch attempts / clutch wins
- last-alive rounds
- survival percentage
- winner-first team ordering from actual round wins

### Still missing / not trustworthy enough yet

These are not strong enough for confident product truth yet:

- full positional area inference like `Banana`, `Apartments`, `Ramp`, `Mid`
- real long-term role identity from one match
- exact official HLTV Impact / HLTV Rating parity
- robust smoke contribution metrics
- richer objective-site occupancy or anchor/lurker certainty

## Derived stats architecture

The advanced stats pipeline still starts in:

- `viewer/src/replay/matchStats.ts`

Role inference is separated into:

- `viewer/src/replay/roleInference.ts`

Shared stat and role types now live in:

- `viewer/src/replay/statsTypes.ts`

The intended structure is:

1. replay artifact is parser-owned truth
2. `matchStats.ts` derives player- and team-level analysis stats
3. `roleInference.ts` turns trustworthy derived signals into conservative style labels
4. `StatsPage.tsx` only selects and presents those stats

That keeps React out of the stat-formula business.

## What the tabs mean

### Summary

Fast overview scoreboard:

- HLTV rating estimate
- K / D / A
- K/D
- ADR
- KAST
- K/R
- HS%
- utility damage

### Duels

First-contact and trade layer:

- opening attempts
- opening kills
- opening deaths
- opening differential
- trade kills
- traded deaths
- trade differential
- top rival with head-to-head tooltip detail

### Utility

Utility usage and effect:

- utility damage
- HE damage
- fire damage
- estimated flash assists
- enemies flashed per flash
- blind seconds per flash
- smokes / flashes / HE / fire thrown

These utility views are intentionally slightly more interpretive than the summary scoreboard:

- they try to communicate effectiveness per throw, not just raw totals
- they still rely only on grounded replay events

### Roles / Style

Single-match tendency view:

- CT-side placement tendency
- T-side placement tendency
- short match note explaining the player's behavior in that match
- underlying role notes retained in tooltips/code for transparency

This view is intentionally match-specific.

It is trying to answer:

- what did this player look like in this match?

It is **not** trying to answer:

- what is this player's permanent team role?
- what map position did they hold all game?

The roles view is now presented more like an analysis lens than a debug table:

- `CT Role`
- `T Role`
- `Match Note`

with the surrounding UI making it clear that these are match-specific inferences, not permanent identity labels.

The `Match Note` is now intentionally short and scan-first:

- it should support the side-role columns, not overpower them
- the note favors compact factual phrasing over longer explanatory sentences

The current product split is:

- `CT Role` / `T Role` = side-specific placement tendency from alive occupancy samples in named map zones
- `Match Note` = event-driven behavioral read from openings, trades, clutches, sniper share, and utility impact

The match note is intentionally conservative:

- weak sniper share should not trigger an `AWPer` read on its own
- light utility contribution should not force `Utility Support`
- when behavior is mixed, the note falls back to explaining where the player mostly played on CT and T in this match
- if support impact is mostly flash-based, the note prefers that over a generic utility-damage sentence

### Advanced

Higher-leverage summary:

- impact proxy
- KAST
- survival %
- clutch wins / attempts
- last-alive rounds
- sniper share
- plants / defuses

The advanced tabs are meant to grow as the product matures, but the current UI now has a clearer product shape:

- `Summary` answers the broad “who had the strongest match?” question
- `Duels` answers “who created first-contact and trade pressure?”
- `Utility` answers “who created value with grenades and flashes?”
- `Roles / Style` answers “where and how did they tend to operate in this match?”
- `Advanced` answers “who generated high-leverage rounds beyond the basic scoreboard?”

The current product presentation goal is:

- keep the lens understandable
- get to the table quickly
- let the table carry the main read

instead of forcing the user to decode the entire tab only from raw columns or stacked helper chrome.

## Role / style inference v1

Current supported behavioral archetypes:

- `Opener`
- `Trader`
- `Closer`
- `AWPer`
- `Utility Support`
- fallback `Balanced`

Signals used:

- opening attempts
- opening kills
- opening deaths
- trade kills
- traded deaths
- multi-kills
- clutch attempts
- clutch wins
- last-alive rounds
- sniper kill share
- utility damage
- flash assists
- enemies flashed
- blind time
- assists

### Placement-aware side roles

The first positional layer is now driven from:

- parser-backed per-tick player positions
- post-freeze alive occupancy only
- side-specific early-round occupancy windows
  - CT uses a longer hold window
  - T uses a shorter route window so labels reflect approach more than end-of-round site presence
- a smarter label chooser
  - T prefers route labels over generic `... Hit` or broad `Mid` outputs when the signal is close
  - CT prefers clearer hold / anchor reads over vague rotation labels when the signal is close
- curated map zones for:
- `de_ancient`
- `de_dust2`
- `de_inferno`
- `de_mirage`
  - `de_anubis`
  - `de_nuke`
  - `de_overpass`
  - `de_train`
  - `de_vertigo`

Current side-role output is intentionally simple:

- CT labels like `A Anchor`, `B Anchor`, `Mid Rotation`, `A Rotation`, `Ramp Hold`, `Yard`
- T labels like `Banana`, `Apartments`, `Mid`, `Boiler / Mid`, `Palace / Ramp`, `Canal`, `A Main`, `A Ramp`, `Long A`, `B Tunnels`, `B Halls`, `Outside`, `Monster`
- fallback `Allround` when occupancy is too diffuse

This is still v1:

- it uses broad curated zones, not perfect tactical subareas
- it is match-specific occupancy, not long-term player identity
- unsupported maps still fall back to no zone model instead of fake labels
- Nuke intentionally stays broad because the current v1 model does not yet use floor-aware upper/lower role labels
- Inferno now separates `Boiler`, `Top Mid`, and `Arch / Library` instead of collapsing most T-side samples into one `Boiler / Mid` bucket
- the chooser now tries to avoid generic late-site labels winning over more specific route labels when the occupancy difference is small
- Inferno now uses a map-specific T-side sampling window so early shared spawn traffic is less likely to flatten every route into one generic mid read
- Inferno CT/T labels are now driven by more specific A-side zoning:
  - `Arch`
  - `Library`
  - `Short`
  - `A Site / Pit`
- Inferno map-specific combo logic now runs before the generic minimum-share fallback, so mixed A defenders can resolve to meaningful `A Anchor` / `A Rotation` labels instead of dropping to `Allround`
- Overpass now has map-specific CT/T role resolution instead of broad generic bucket fallback:
  - CT can resolve to `A Anchor`, `A Rotation`, `Mid Rotation`, `B Anchor`, `B Rotation`
  - T can resolve to route pairings like `Monster / Water`, `Monster / Short`, `A Long / Mid`, `Mid / A`
- Ancient now has map-specific CT/T role resolution instead of relying only on the top raw bucket:
  - CT can resolve more intentionally around `A Site / Donut`, `Donut / Mid`, `Mid / Temple`, `B Lane / Temple`, `B Lane / B Site`
  - T can now separate dominant `Cave` from genuinely mixed `Cave / Mid`, `Mid / Donut`, `Mid / B`, and `Temple / Mid`
- Mirage now has light map-specific CT/T role resolution on top of the zone model:
  - CT can resolve more intentionally around `A Site / Ramp`, `A Site / Connector`, `Mid / Connector`, and `Apartments / B Site`
  - T can now distinguish `Apartments / B` and `Apartments / Mid` from plain `Apartments` when the route is genuinely mixed
- The remaining active-pool maps now also have conservative map-specific resolver logic instead of relying entirely on generic fallback:
  - `de_anubis`
  - `de_dust2`
  - `de_nuke`
  - `de_train`
  - `de_vertigo`

### Fixture validation snapshot

The current role layer was checked against the local staged replay set:

- `de_mirage`
- `de_ancient`
- `de_overpass`
- `de_inferno`

What the fixture pass improved:

- weak sniper share no longer produces obviously silly AWP notes
- support notes now prefer `flash pressure` or `utility pressure` wording instead of claiming support from near-zero flash assists
- Inferno CT reads are more believable now:
  - short-heavy A defenders resolve as `A Anchor`
  - mixed arch/short defenders can resolve as `A Rotation`
  - mixed arch/top-mid defenders can still resolve as `Mid Rotation`
- Inferno T reads can now stay honestly `Second Mid` or promote to `Top Mid` when deeper mid presence is real, instead of flattening both into a generic `Mid`
- route-based T labels are less biased toward final execute positions because occupancy is now sampled from the early part of each round
- Inferno now produces more distinct `Second Mid`, `A Site`, and `Arch / Library` tendencies instead of overusing one generic mid bucket
- Mirage T labels read more like `Apartments` and `B Hit` routes instead of drifting toward late-round site presence
- close occupancy ties now prefer more specific route/hold labels over broad `Hit`, `Mid`, or generic rotation reads
- when the Inferno fixture is truly mid-heavy, the role layer now says `Second Mid` explicitly instead of hiding that behind a broad `Mid` label
- Inferno now promotes `Top Mid` over `Second Mid` when the deeper mid share is meaningfully present, so mixed mid routes no longer flatten into one generic label
- Overpass CT reads now separate `B Anchor` from `B Rotation` and `Mid Rotation` more credibly instead of overusing generic `Short / Water` style outputs
- Overpass T reads now produce more believable monster-side routes like `Monster / Water` instead of broad undifferentiated B-route labels
- Ancient CT reads now keep dominant `Mid` players as `Mid Rotation` instead of overpromoting `B Rotation` from tiny secondary temple shares
- Ancient T reads now keep dominant `Cave` players as `Cave` while still exposing genuine mixed `Cave / Mid` behavior when the split is real
- Mirage CT reads now separate `Mid / Connector` and `A Site / Ramp` patterns more intentionally instead of falling back to whichever single zone barely wins
- Mirage T reads now surface mixed `Apartments / B` and `Apartments / Mid` routes instead of flattening almost every B-side path into plain `Apartments`

What still needs more refinement later:

- Overpass is materially better, but A-side route separation is still broader than B-side route separation
- Ancient is materially better, but the map still leans `Cave` / `Mid` heavy because the v1 zoning is intentionally coarse
- Nuke needs floor-aware upper/lower treatment before it can support stronger role labels
- maps without staged fixtures in the repo still need the same output-driven validation before their labels should be considered equally trustworthy
- fixture-validated first:
  - `de_inferno`
  - `de_overpass`
  - `de_ancient`
  - `de_mirage`
- authored-but-not-yet-fixture-validated:
  - `de_anubis`
  - `de_dust2`
  - `de_nuke`
  - `de_train`
  - `de_vertigo`

### Product honesty

This is not a claim about a player's real long-term team role.

It is:

- a conservative single-match tendency estimate
- intentionally willing to fall back to `Balanced`
- explained in plain language through a short match note

### What it does **not** do yet

- official or polygon-grade map callout ingestion
- strong long-term anchor/lurker/rotator identity across many matches
- trustworthy fine-grained positional callouts everywhere in the active pool

Products like Skybox likely get closer to those labels by combining:

- many rounds of occupancy data
- map-area zoning
- side-context
- larger-sample tendencies across matches

This repo intentionally does **not** fake those labels until parser-backed area truth exists strongly enough to defend them.

## Approximate metrics and caveats

### `HLTV Rating`

The current `HLTV Rating` column is an approximation, not the official HLTV formula.

It uses:

- KAST
- KPR
- DPR
- ADR
- a Litepac impact proxy

### `Impact`

Current impact is also approximate.

It is built from:

- opening kills
- opening deaths
- multikill pressure
- clutch pressure

### `Estimated flash assists`

Current flash assists are a grounded heuristic:

- player A flashes enemy B
- B dies before the blind window ends
- the killer is a teammate of A

This is useful, but not guaranteed to match an official engine-side stat.

## Next best improvements

1. Add duel pair detail beyond `Top Rival`, probably as expandable or hover detail.
2. Tighten utility support metrics with more explicit per-utility-family usage rates.
3. Add parser-backed positional truth if the product really needs `Banana` / `Mid` / `Ramp` style labels.
4. Improve clutch detection with stronger edge-case validation.
5. Decide whether the product wants to keep an approximate `HLTV Rating` label or move to a clearly product-owned rating label.
6. If advanced stats keep growing, split more derivation helpers out of `matchStats.ts` so the file stays small and testable.

## Files touched for this milestone

- `viewer/src/replay/matchStats.ts`
- `viewer/src/replay/roleInference.ts`
- `viewer/src/controls/StatsPage.tsx`
- `viewer/src/app/app.css`
