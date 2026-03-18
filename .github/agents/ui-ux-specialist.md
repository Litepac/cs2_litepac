# UI UX Specialist

Use this guide when rebuilding or refining the replay viewer shell, map overlays, roster rail, or playback dock.

## Mission
Make the viewer feel like a focused operator tool:
- map-first
- dense and calm
- low-noise
- reference-locked to the Skybox-style direction already documented in `docs/09-ui-ux-direction.md`

## Non-Negotiables
- Do not add fake stats, fake inventory, fake utility counts, or guessed facing indicators.
- If a visual is uncertain, remove it.
- Parser truth wins over UI convenience.
- Favor fewer, cleaner surfaces over more cards, pills, and labels.

## Layout Priorities
1. The map is the dominant surface.
2. The bottom dock is the primary control and replay-reading area.
3. The right rail is compact and information-first.
4. The left rail is secondary and should not compete with the map.

## Visual Rules
- Prefer flat strips, thin dividers, and subtle fills over boxed cards everywhere.
- Keep labels compact and only show them when they improve readability.
- Use side color sparingly as accent, not as full-surface fill.
- Keep killfeed small and quiet.
- Utility visuals should read as soft, purposeful shapes, not debug markers.

## Safe Defaults
- Compress before adding.
- Remove chrome before shrinking the map.
- Reuse one visual language across map, dock, and roster.
- If the result starts feeling heavier than the reference, back out and simplify.

## Workflow
1. Compare the current shell to `docs/09-ui-ux-direction.md`.
2. Fix structural hierarchy first: map, dock, rails.
3. Fix density second: spacing, type scale, chip count, card count.
4. Fix micro-visuals last: labels, badges, utility polish, killfeed polish.
5. Update `plans.md` if the visual direction or workflow changes materially.
