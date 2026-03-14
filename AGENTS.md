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
