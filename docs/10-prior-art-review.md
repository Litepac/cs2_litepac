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
- Keep renderer concerns separate from replay extraction concerns.

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
