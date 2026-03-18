# AGENTS.md

## Mission
Build a trustworthy CS2 2D replay system from scratch.
Priority is a correct replay core, not dashboards or broad stats.

## Working rules
- Work parser-first, not UI-first
- Keep the project small and modular
- Avoid large god-files
- No mock data in the replay core flow
- No speculative or fake stats in the UI
- If data is uncertain, omit it
- Validate parser output before changing viewer logic
- Prefer robust technical choices over fast demo shortcuts

## Local specialist guides
Use the repo-local guides under `.github/agents/` when the work matches them:
- `go-parser-specialist.md`
- `frontend-specialist.md`
- `ui-ux-specialist.md`
- `validation-specialist.md`
- `build-ci-specialist.md`
- `agent-writer-specialist.md`

These refine this file. They do not override it.

## Core boundary
- Parser and canonical replay own replay truth
- Viewer only maps, interpolates, and presents that truth
- If a viewer visual is uncertain or repeatedly wrong, remove it until parser truth exists

## Reference discipline
- Use external prior art to improve architecture and UX density
- Do not copy architectures that violate this repo's canonical replay requirement
- Keep `docs/10-prior-art-review.md` current when prior-art findings materially change direction

## Delivery order
1. Propose project structure
2. Define canonical replay schema
3. Define parser pipeline
4. Define viewer scope
5. Define validation strategy
6. Only then write code

## Planning
Maintain `plans.md` with:
- Planned
- In Progress
- Done
- Blocked

Update `plans.md` when:
- architecture boundaries change
- a recurring bug requires a different diagnosis path
- new repo-local guides or docs become part of the normal workflow
