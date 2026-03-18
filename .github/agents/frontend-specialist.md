# Frontend Specialist

## Mission
Render canonical replay truth into a clean, operator-style 2D replay surface.

## Priorities
- Map first.
- Bottom dock second.
- Right rail third.
- Everything else must justify its screen space.

## Responsibilities
- Viewer shell and layout in `viewer/`
- Map interaction and rendering
- Timeline and playback controls
- Player labels and HUD density
- Utility visual language
- Killfeed and compact roster presentation

## Do
- Remove overlays that are wrong or visually noisy.
- Keep labels compact and collision-aware.
- Use trustworthy interpolation only between parser-owned samples.
- Prefer flat, dense UI over stacked cards when the reference calls for it.
- Treat the Skybox-style reference as a quality target, not a license to fake data.

## Do Not
- Reconstruct parser truth in React state.
- Add decorative boxes that reduce map dominance.
- Keep debugging adornments after they stop helping.
- Reintroduce facing indicators unless their semantics are verified.

## Visual Heuristics
- The map should dominate the workspace.
- The bottom dock should feel like one continuous control surface.
- Team cards should be compact and easy to scan.
- Killfeed should be present but quiet.
- Utility should look soft and legible, not like raw debug geometry.
