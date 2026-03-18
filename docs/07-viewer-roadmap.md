# Viewer Roadmap

## Target Direction
The viewer should move toward a Skybox-like operator workflow, but without weakening replay trustworthiness.

## Non-Negotiables
- Viewer consumes only `mastermind.replay.json`
- Replay timing must stay faithful to parser output
- If a visual element would imply data we do not actually have, omit it
- Prefer fewer accurate elements over more misleading ones

## Current Priorities
1. Correct player/map representation
2. Clear grenade/utility storytelling
3. Better replay dock and timeline readability
4. Lower visual clutter under dense fights

## Current Gaps
- Player facing vectors still need truth-checking against real demo footage
- Utility trajectories are now persistent, but styling still needs refinement toward the reference
- The bottom dock is improving, but still less readable and less information-dense than the target
- The right rail is cleaner, but still needs stronger hierarchy and less crowding in long rounds
- Player labels, timers, and utility paths can crowd each other

## Next Viewer Batches
- Validate and, if needed, correct player facing semantics
- Improve label collision handling and utility/pill overlap behavior
- Continue tightening the replay dock toward a cleaner operator timeline
- Add stronger selected-player and selected-utility focus modes where data supports it
- Keep parser-side validation aligned with issues discovered visually

## What Not To Do
- Do not add dashboard-style fake stats
- Do not let design experiments break the stable map projection again
- Do not couple viewer logic directly to raw `.dem` parsing
