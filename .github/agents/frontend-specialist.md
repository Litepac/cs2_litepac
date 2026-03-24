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
- Prefer a small reusable component system over one-off shell patterns.
- Keep components composable and name them clearly.
- Keep business logic out of presentational components when practical.
- Reuse a new pattern consistently once it is introduced.
- Treat loading, empty, and error states as part of the feature, not follow-up polish.

## Do Not
- Reconstruct parser truth in React state.
- Add decorative boxes that reduce map dominance.
- Keep debugging adornments after they stop helping.
- Reintroduce facing indicators unless their semantics are verified.
- Leave placeholder-grade product shell UI behind after the main flow works.
- Default to generic dashboard layout or empty metric tiles just because the screen needs content.

## Visual Heuristics
- The map should dominate the workspace.
- The bottom dock should feel like one continuous control surface.
- Team cards should be compact and easy to scan.
- Killfeed should be present but quiet.
- Utility should look soft and legible, not like raw debug geometry.
