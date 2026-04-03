# 09 UI UX Direction

## Goal
Move the viewer toward an operator-style replay surface similar in spirit to Skybox while staying truthful to the canonical replay data.

## Principles
- Make the map the dominant surface.
- Keep the bottom dock as the main control strip.
- Keep the right rail compact, dense, and information-first.
- Prefer calm, legible overlays over loud badges and boxes.
- If a visual element is uncertain, omit it.
- Parser and canonical replay own replay truth. Viewer only maps, interpolates, and presents that truth.

## Immediate Direction
- Collapse round navigation, utility filters, playback, and seek into one continuous bottom dock.
- Remove wasted vertical chrome above the map.
- Keep labels compact and offset so the map remains readable.
- Render player facing with short, clean indicators only if backed by real yaw data.
- Treat utility visuals as soft shapes, not debug primitives.

## Skybox-Inspired Targets
- Thin round-number strip above the main timeline.
- Left-anchored play/time block in the dock.
- Flat phase band and event rows instead of stacked card sections.
- Compact right-side team cards with strong score hierarchy.
- Small, clean killfeed in the top-right map area.
- Support map pan and zoom in a later pass.

## Current Priorities
1. Bottom dock hierarchy and density.
2. Map readability: labels, killfeed, HUD restraint, and only trustworthy facing markers.
3. Right-rail compact roster styling.
4. Cleaner utility visual language for smoke and fire.
5. Move ambiguous replay-state logic out of the viewer and into parser/canonical artifact ownership.
6. Map pan/zoom interaction.

## Replay Shell Structure
- Keep the left rail for app-level destinations only.
- Do not use the narrow left rail as a vertical tab stack for sibling replay modes.
- Put replay mode switching in a single horizontal strip adjacent to the mode's controls so the active tool and its settings read as one surface.
- Keep that strip compact enough to preserve the map as the dominant surface, and prefer short labels over wrapped mode names.

## Reference Locked Rebuild
- Remove noisy or wrong overlays before adding polish.
- Do not let utility filters or secondary controls consume map height above the stage.
- Keep the round strip thin and directly attached to the operator dock.
- Treat team rails as compact scoreboards, not generic cards.
- If a pass makes the shell feel heavier or uglier than the reference, back it out and simplify.
