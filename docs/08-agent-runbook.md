# Agent Runbook

## Purpose
This file is the practical continuation guide for future work in this repository.

Use it when:
- continuing implementation after a pause
- debugging viewer regressions
- validating parser/viewer changes against real demos
- handing off work between sessions

## Core Rules
- Respect `AGENTS.md` first
- Keep `plans.md` current
- Do not add fake replay data to unblock UI work
- Validate parser output before changing viewer interpretation
- Prefer localized fixes over broad visual experiments

## Current Safe Workflow
1. Parse real demos into canonical replay files
2. Stage replay fixtures into `assets/fixtures`
3. Open the viewer on real staged replay data
4. Compare specific rounds against observed demo behavior
5. Fix either parser semantics or viewer interpretation, not both blindly

## Commands

### Parse fixtures
```powershell
cd parser
go run .\cmd\fixtureparse
```

### Stage fixtures for the viewer
```powershell
cd parser
go run .\cmd\fixturestage
```

### Parser verification
```powershell
cd parser
go test ./...
```

### Viewer verification
```powershell
cd viewer
npm.cmd run build
```

## Current Truth Sources
- Architecture/contracts: `docs/01-05`
- Current implementation state: `docs/06-current-status.md`
- Viewer direction: `docs/07-viewer-roadmap.md`
- Execution state: `plans.md`

## Known Sensitive Areas

### 1. Map projection
- The stable state is full-radar fit with centered projection
- Previous crop/projection experiments caused visible regressions
- Do not reintroduce auto-crop logic casually

### 2. Player aim vectors
- Current rendering may still be semantically wrong
- If facing lines look wrong, verify yaw meaning before changing styling again
- Treat this as a parser/viewer truth-check issue, not a pure CSS issue

### 3. Utility trajectories
- The user wants full visible grenade paths similar in spirit to Skybox
- If trajectories are missing, check:
  - `sampleIntervalTicks`
  - `sampleOriginTick`
  - trajectory sample coverage
  - world-to-screen filtering
  - whether history rendering is being prematurely skipped

### 4. Timeline quality
- The dock is functional but still below target quality
- Prefer improving structure and readability over adding more categories

### 5. Visual clutter
- Label overlap, utility badges, timers, and paths can conflict
- Reduce clutter by prioritizing placement and layering before removing real information

## Preferred Debug Order

### If the issue is visual correctness
1. Confirm the replay JSON has the expected data
2. Confirm the viewer is using that data as intended
3. Only then refine styling

### If the issue is missing data
1. Inspect parser output in `testdata/replays`
2. Check whether the canonical schema already allows the needed field
3. Update parser extraction only if the source demo data is actually reliable

## What To Avoid
- Do not use mock data to test viewer ideas
- Do not quietly reinterpret uncertain data as certain UI
- Do not let the viewer start consuming raw `.dem`
- Do not rewrite large stable areas just to chase a visual reference

## Current Best Next Steps
- Finish reliable full-trajectory utility rendering
- Truth-check player facing vectors against real demo playback
- Improve operator-dock hierarchy and density
- Continue reducing on-map clutter under dense fights
