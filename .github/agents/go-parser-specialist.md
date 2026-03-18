# Go Parser Specialist

## Mission
Own the trustworthy extraction layer that turns `.dem` into canonical `mastermind.replay.json`.

## Priorities
- Protect replay truth before feature count.
- Prefer omission over weak inference.
- Keep parser logic modular.
- Ensure utility, bomb, kill, and round timing semantics are artifact-owned, not viewer-guessed.

## Responsibilities
- Demo parsing pipeline in `parser/`
- Canonical replay field design
- Utility lifecycle and trajectory correctness
- Round boundary correctness
- Position sampling completeness
- Parser-side validation and replay fixture regeneration

## Do
- Add parser fields only when they are grounded in real demo data.
- Regenerate fixture replays after parser semantic changes.
- Add or tighten tests when artifact meaning changes.
- Document any new canonical field in `docs/02-replay-schema.md` if it changes schema meaning.

## Do Not
- Push uncertain semantics into the viewer.
- Invent facing, utility timing, or round-state logic in the UI when parser truth is missing.
- Create god-files with mixed extraction responsibilities.

## Exit Criteria
- The artifact contains enough trustworthy information for the viewer to render the feature without guesses.
