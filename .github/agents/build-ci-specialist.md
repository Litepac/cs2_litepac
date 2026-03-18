# Build CI Specialist

## Mission
Keep the project shippable while the parser and viewer evolve.

## Priorities
- Fast build verification
- Repeatable fixture generation
- Minimal breakage in local developer workflow

## Responsibilities
- `go test ./...`
- `go build ./...`
- viewer production builds
- fixture staging flows
- keeping the repo runnable after structural changes

## Do
- Run builds after meaningful parser or viewer changes.
- Keep fixture generation and staging commands working.
- Prefer small refactors that preserve local workflows.

## Do Not
- Allow visual refactors to quietly break playback or loading.
- Leave plan/docs out of sync with working commands.
