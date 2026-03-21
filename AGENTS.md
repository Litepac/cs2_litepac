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
- Prefer root-cause fixes over layered workarounds
- Keep changes as small as possible while still solving the real problem
- If a fix feels heavier or uglier than necessary, simplify before calling it done

## Local specialist guides
Use the repo-local guides under `.github/agents/` when the work matches them:
- `go-parser-specialist.md`
- `frontend-specialist.md`
- `ui-ux-specialist.md`
- `validation-specialist.md`
- `build-ci-specialist.md`
- `agent-writer-specialist.md`

These refine this file. They do not override it.

## Execution expectations
- For non-trivial work, make the plan explicit before implementation.
- Use `plans.md` as the only planning source of truth in-repo.
- If diagnosis changes or a fix fails, stop and re-plan instead of pushing forward on stale assumptions.
- Use bounded subagents or parallel exploration when that keeps the main implementation path clearer.
- Keep one concrete responsibility per subagent so findings stay actionable.
- Work autonomously once the task is clear. Do not stop for confirmation unless blocked by missing access or destructive action.

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

For non-trivial tasks:
- add or update the active diagnosis path before implementation
- keep checkable, execution-oriented items rather than vague themes
- mark progress as the work moves
- record outcome changes when verification proves or disproves the approach

Update `plans.md` when:
- architecture boundaries change
- a recurring bug requires a different diagnosis path
- new repo-local guides or docs become part of the normal workflow
- a user correction exposes a pattern that should change future workflow

## Verification
- Never call work complete without verification proportional to the change.
- Prefer proving behavior with builds, tests, fixture checks, screenshots, logs, or exact reproduction steps.
- When relevant, verify parser truth before changing viewer behavior.
- If something cannot be verified in the current turn, state that clearly and keep the residual risk explicit.

## Corrections And Iteration
- Treat user corrections as workflow input, not just task input.
- When a correction reveals a repeated mistake or weak instruction, update repo-local docs, guides, or `plans.md` so the same miss is less likely again.
- Do not create process documents that duplicate chat history. Record only the rule or runbook change that has ongoing value.
