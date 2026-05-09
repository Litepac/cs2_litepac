# 10 Prior Art Review

## Context
This project now has a clear external reference point in `sparkoo/csgo-2d-demo-viewer`.

The useful question is not whether to copy that repository. The useful question is which architectural decisions validate our direction and which ones conflict with our hard requirements.

## What The Repo Confirms
- A parser-first pipeline is the right shape for a trustworthy 2D replay product.
- `demoinfocs-golang` remains a credible parser foundation for CS parsing work.
- A thin player/viewer layer should focus on rendering and interaction, not inventing replay truth.
- Compact operator-style UI, map-first layout, and dense round navigation are valid targets.

## What We Should Not Copy
- Their browser runtime parses raw demos through WASM.
- Their transport format is custom protobuf between parser and player.
- Their product accepts raw demos directly in the viewer path.

That conflicts with this project's canonical contract:
- parser produces `mastermind.replay.json`
- viewer consumes `mastermind.replay.json`
- viewer does not parse `.dem`

## What We Should Reuse In Spirit
- Keep the map visually dominant.
- Keep the timeline flat, dense, and operator-oriented.
- Keep the right-side team rail compact and information-first.
- Keep utility visuals calm and readable rather than debug-heavy.
- For the replay dock, prefer grouped event lanes over one undifferentiated marker strip when kills, utility, and bomb events are all visible. Sports-analysis tools commonly use timeline markers to jump to tagged events, and session-analysis tools group dense events into easier-to-read buckets; DemoRead should adapt that idea as parser-owned "round evidence" lanes rather than a copied media scrubber.
- For live roster cards, ESL-style broadcast overlays are a useful density reference: lead with side-colored HP/name/weapon identity, then compactly expose utility, money/equipment, and current-round impact. Do not copy broadcast-only economy guesses such as loss bonus/equipment value unless parser truth exists.
- Keep renderer concerns separate from replay extraction concerns.
- Treat multi-round position tools as pattern-finders, not generic overview clutter: external tools like Noesis and team-analysis suites push positions toward repeated movement/strategy discovery, round filtering, and quick jump-back into concrete replay examples.
- Keep player-position study narrow and legible: selected-player timing/pattern study should be the primary workflow, while broad all-player compare should stay explicit and secondary.

## Replay Tooling Direction From Broader Prior Art
Current CS2 review products converge on a few tool families rather than a large menu of unrelated overlays:

- Fast round filtering is a first-class analysis tool, not just library chrome: side, buy state, result, bomb events, opening kill, clutch, player, weapon, and utility filters should make the right rounds appear before the user starts scrubbing.
- Multi-round pattern tools work when they answer a narrow question: repeated routes, one player's timing, utility families, or strategy timing. Generic "show everything" overlays quickly lose analytical value.
- Death and duel review are high-value because they connect replay truth to improvement: where the death happened, what the trade window looked like, spacing to teammates, utility context, and what happened in the seconds before the fight.
- Utility review should move beyond "where was it thrown" toward "what did it change" when parser truth supports it: flash victims, HE damage, fire denial time, smoke active windows, and whether a throw preceded an execute, retake, save, or death.
- Notes/bookmarks/playlists matter because replay review is a workflow. A timestamped note that jumps back to a round/tick is often more useful than another passive visual layer.
- Timing tools are a strong fit for this product if kept parser-backed: first contact, first utility, execute/contact timing, rotate timing, bomb plant/defuse timing, and repeated player position at a shared round clock.
- Heatmaps should remain secondary unless user feedback proves a clear job. If kept, the tool needs a sharply defined question such as "where did this player spend time?" or "where did deaths happen?", not broad movement coloring.

## Tool Priority Implication
DemoRead should not add more sidebar modes until the current modes are shaped into sharper workflows. The next high-value additions are likely:

1. Round Finder / Review Queue.
2. Death Review.
3. Duel + Trade Review.
4. Timing Review.
5. Utility Impact Review.
6. Notes / Bookmarks.

Each should jump back into the canonical live replay instead of becoming a disconnected dashboard.

## Product Thesis: Explain The Round
The replay market is crowded with 2D viewers, utility overlays, heatmaps, drawing tools, and stats pages. DemoRead's strongest product angle should be round explanation:

> A 2D replayer that explains why the round changed, not just where players moved.

This does not mean adding broad AI summaries or speculative coaching. It means building parser-backed evidence tools that answer concrete questions:

- Where did control change?
- Which kill, death, utility, timing, or rotation changed the round state?
- Was a death tradeable or isolated?
- Did utility create pressure, delay, damage, or blind value?
- Which player created space, lost space, or arrived too late?
- Which pattern repeated across rounds?

The highest-potential tools for this thesis are:

- **Round Swing Timeline**: annotate parser-backed turning points such as first damage, opening kill, trade response, bomb plant/spotted events, utility windows, and late-round advantage loss. Avoid win-probability claims until a defensible model exists.
- **Death Autopsy**: click a death and show killer/victim positions, recent victim path, nearby teammate support, flash/damage context, bomb state, and whether a fast trade happened.
- **Trade And Spacing Review**: measure teammate distance and time-to-response around duels so the user can see isolated deaths, late swings, and missed trade windows.
- **Timing Race Review**: compare player arrivals, first contact, rotate arrival, execute start, and post-plant timings across rounds using shared round-clock anchors.
- **Utility Impact Review**: move beyond throw paths by surfacing parser-backed impact such as flash victims, HE damage, fire denial duration, smoke active windows, and whether teammates acted while the utility mattered.
- **Round Summary / Review Card**: after a round, show a compact evidence-backed list of turning points with jump links into the replay, not a generic prose diagnosis.

Space-control overlays are promising but should be treated carefully. True "controlled / contested / unknown" territory requires a clear model for vision, player positions, utility blockers, deaths, and information state. Start with simpler parser-backed control evidence such as player presence zones, recent deaths, bomb visibility events, and utility-denied lanes before presenting hard control claims.

## Architectural Boundary For This Repo
Parser owns:
- round timing
- player samples
- utility lifecycle and trajectory truth
- bomb state truth
- kill event truth
- any future validated facing/yaw truth

Viewer owns:
- interpolation between trustworthy samples
- map transforms and interaction
- layout, controls, density, and visual hierarchy
- omission of uncertain overlays

Viewer must not own:
- guessed utility phases
- guessed player facing
- reconstructed stats not present in canonical replay

## Practical Next Actions
1. Continue tightening the canonical replay artifact where rendering still feels underpowered.
2. Use the reference repository for UI density, map interaction, and shell structure.
3. Refuse the raw-demo-in-viewer architecture because it violates our canonical replay requirement.
4. Keep project-local agent guides so future work follows these boundaries consistently.
