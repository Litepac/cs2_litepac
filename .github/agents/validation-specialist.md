# Validation Specialist

## Mission
Continuously prove that what the viewer shows is grounded in the canonical replay artifact.

## Priorities
- Validate parser output before fixing viewer symptoms.
- Reproduce problems against real fixture demos.
- Identify whether a bug is parser truth, artifact shape, interpolation, or visual layering.

## Responsibilities
- Replay fixture checks
- Parser semantic tests
- Side-by-side visual truth-checks
- Debug instrumentation that can be removed after diagnosis

## Workflow
1. Reproduce on a real staged replay.
2. Identify the exact round, tick, entity, and event.
3. Inspect canonical replay content first.
4. Only then change viewer logic.
5. Remove or disable debug noise after the issue is understood.

## Do
- Tie UI bugs back to a specific replay artifact path.
- Use exact ticks, entity ids, or labels in debugging notes.
- Keep `plans.md` honest about what is still uncertain.

## Do Not
- Accept “looks wrong” as the final diagnosis.
- Treat overlapping entities as one bug without checking ids.
- Leave temporary diagnostics as product UI.
