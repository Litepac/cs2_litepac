# UI UX Specialist

Use this guide when rebuilding or refining the replay viewer shell, map overlays, roster rail, or playback dock.

## Mission
Make the viewer feel like a focused operator tool:
- map-first
- dense and calm
- low-noise
- reference-locked to the Skybox-style direction already documented in `docs/09-ui-ux-direction.md`
- sharp and release-capable when working on the Home, Matches, and ingest shell surfaces

## Non-Negotiables
- Do not add fake stats, fake inventory, fake utility counts, or guessed facing indicators.
- If a visual is uncertain, remove it.
- Parser truth wins over UI convenience.
- Favor fewer, cleaner surfaces over more cards, pills, and labels.
- Empty, loading, and error states are required for any ship-facing surface.
- Every screen should have one obvious primary action.
- Avoid generic SaaS-dashboard structure unless the task explicitly asks for it.

## Layout Priorities
1. The map is the dominant surface.
2. The bottom dock is the primary control and replay-reading area.
3. The right rail is compact and information-first.
4. The left rail is secondary and should not compete with the map.

For non-replay product shell work:
1. Home should welcome and orient.
2. Matches should act as the operational library.
3. Replay view should stay separate from product-shell marketing or library concerns.

## Visual Rules
- Prefer flat strips, thin dividers, and subtle fills over boxed cards everywhere.
- Keep labels compact and only show them when they improve readability.
- Use side color sparingly as accent, not as full-surface fill.
- Keep killfeed small and quiet.
- Utility visuals should read as soft, purposeful shapes, not debug markers.
- Brand and product identity should be visible above the fold on Home, but should not overpower the replay workspace.
- Avoid empty black voids, generic hero templates, or noisy metric tiles used only to fill space.
- Use spacing, hierarchy, and restraint to create the premium feel before adding more chrome.
- Keep the UI usable on laptop-sized screens without relying on hidden critical actions.

## Safe Defaults
- Compress before adding.
- Remove chrome before shrinking the map.
- Reuse one visual language across map, dock, and roster.
- If the result starts feeling heavier than the reference, back out and simplify.
- Show fewer things better.
- Stats should support the replay, not dominate it.
- Important state changes should be obvious without becoming flashy.

## Workflow
1. Compare the current shell to `docs/09-ui-ux-direction.md`.
2. Briefly state the intended screen structure before implementation.
3. Fix structural hierarchy first: map, dock, rails, or Home/Matches/replay separation.
4. Fix density second: spacing, type scale, chip count, card count.
5. Fix micro-visuals last: labels, badges, utility polish, killfeed polish.
6. Self-critique the result and clean obvious rough edges before stopping.
7. Update `plans.md` if the visual direction or workflow changes materially.
