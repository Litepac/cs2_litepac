# Viewer Roadmap

## Target Direction
Home should sell the product direction, Matches should manage the local library, Replay should behave like an operator / analysis workspace, and Stats should be a dense match-analysis surface. None of that should weaken canonical replay trustworthiness.

For the current V1 product shape and gap audit, use `docs/14-replay-v1-product-spec.md`.

## Non-Negotiables
- Viewer consumes only `mastermind.replay.json`
- Replay timing must stay faithful to parser output
- If a visual element would imply data we do not actually have, omit it
- Prefer fewer accurate elements over more misleading ones
- The normal Replay timeline remains the transport source for live playback and `Position Player`

## Current Priorities
1. Make `Position Player` a trustworthy selected-player cross-round movement study mode while keeping `Position Paths` stable
2. Preserve map/token alignment and click-to-round correctness by tracing through parser-backed player streams instead of UI-only fixes
3. Keep the Replay dock and timeline compact, readable, and shared by normal replay plus `Position Player`
4. Continue role/stat polish only where the parser already exposes trustworthy match truth

## Current Gaps
- `Position Player` still needs careful validation for selected-player-first study, explicit broad-compare fallback, CT/T filtering, round labels, and click-token replay jumps
- Snapshot tokens can still feel slightly off if they diverge from the same interpolation path used by live player rendering
- Dense rounds can still crowd player labels, utility timers, and utility paths
- Some Stats role labels remain conservative but rough on maps that have less fixture-backed tuning

## Next Viewer Batches
- Add fixture-backed validation around `Position Player` snapshot extraction, round numbering, and jump targets
- Improve `Position Player` selected-player study quality first, then only add faded context around the jumped live round if it stays analytically useful
- Keep `Position Paths` route lines intact while hardening `Position Player` as a separate mode
- Keep broad all-player comparison explicit and secondary so the main workflow stays centered on one player at a time
- Tighten visual clutter and focus states in Replay only after parser-aligned movement analysis is solid
- Keep parser-side validation aligned with any viewer mismatches discovered during replay-analysis QA

## What Not To Do
- Do not add dashboard-style fake stats
- Do not let design experiments break the stable map projection again
- Do not couple viewer logic directly to raw `.dem` parsing
- Do not revive the old `1 / 5 / 10 / Half / All` transport model for `Position Player`
