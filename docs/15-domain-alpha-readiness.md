# Domain Alpha Readiness

## Purpose
Define the shortest credible path from the current local-first product to a domain-hosted private alpha.

This is not a launch plan for a broad public product. It is the checkpoint that separates:

- a strong local prototype
- from a professional hosted alpha that can survive real users on a real domain

## Product stance
Replay remains the hero product surface.

Home, Matches, and Stats should support Replay, but the move to a hosted domain should not turn the roadmap into a dashboard or marketing-site exercise.

If tradeoffs are required, prioritize:

1. trustworthy replay truth
2. reliable hosted ingest and match persistence
3. one polished replay workflow
4. secondary polish later

## Current reality
The current system is still optimized for local use:

- demo parsing assumes a local parser path or local bridge
- match persistence is centered on browser storage
- friend-testing uses local tunnels and local logs
- startup behavior is still partly shaped by machine-specific policy constraints

That is acceptable for development, but it is not yet the architecture of a real hosted product.

## Domain-alpha milestone
The product is ready for a private hosted alpha when all of the following are true:

- demos can be uploaded to a hosted parser service
- parse results and match library data persist server-side
- the user can return later and still find the same match
- Replay is strong enough that a first user can understand why the product is useful without hand-holding
- obviously temporary or internal-only assets are removed from ship-facing surfaces
- the deployment path is stable enough that the product does not depend on one developer machine's local setup

## Highest-priority work before a real domain push

### Readiness audit snapshot
The April 2026 repo audit confirmed that the current product is good enough for local friend testing through Cloudflare Tunnel, but not for a true domain-backed alpha yet.

Critical gaps:

- hosted ingest is still synchronous/local-first instead of an async job/artifact flow
- match persistence is still browser-local instead of server-backed
- public API hardening is not in place yet: auth/invite gating, origin policy, upload limits, rate limits, and parser concurrency limits
- validation needs stricter canonical invariants before more viewer assumptions depend on it
- the frontend still carries too much old/experimental code in the active bundle

Near-term cleanup:

- code-split Home / Matches / Replay so the public landing page stays light
- remove or dev-gate retired Home / Matches V2 / legacy replay surfaces
- split global CSS into active surface files and centralize DemoRead tokens
- extract the large replay page into smaller behavior-preserving components
- add minimal viewer tests for replay stream parsing, match summaries, and timeline marker construction

### 1. Hosted ingest architecture
Move the parser/upload flow away from local-machine assumptions.

Minimum bar:

- hosted parser API
- durable upload handling
- replay artifact persistence
- async parse job lifecycle or equivalent durable ingest flow
- operational safeguards such as upload limits, timeouts, cleanup, and basic abuse protection

Without this, a domain still fronts a local-style prototype rather than a product.

### 2. Server-backed match library
The current local library is development scaffolding.

Minimum bar:

- server-backed stored matches
- stable match identity beyond one browser
- reopen flow that survives page reloads and returning sessions
- clear ownership/session model, even if auth is still lightweight at alpha stage

### 3. Finish the core replay value narrowly
Do not broaden the product while the hosted foundation is still weak.

The highest-value Replay work remains:

- finish `Position Player`
- strengthen live selected-player study
- improve dense-fight readability
- sharpen utility-review-to-live jumps

That is enough to make the hosted alpha feel like a real product instead of a parser demo.

### 4. Replace ship-risk temporary assets
Anything acceptable only for private/internal exploration must be removed before public-facing hosting.

This especially includes:

- temporary extracted game-derived equipment silhouettes or similar placeholders
- internal-only visual shortcuts that are not safe for a ship-facing product

### 5. Basic product hardening
Before domain launch, the product should tolerate normal failure and observation paths.

Minimum bar:

- clear upload and parser-failure states
- structured logging for hosted ingest problems
- simple deployment runbook
- one known-good environment path
- basic monitoring or analytics that are reliable enough to support iteration

## Lower-priority work until after alpha

### Stats polish
Stats should remain secondary until hosted ingest and Replay usefulness are strong.

### New analysis modes
Do not add more modes before `Position Player` and the live replayer feel finished.

### Broad marketing/design expansion
Do not spend major iteration budget on launch-page ambition while the hosted ingest architecture is still local-first underneath.

## Recommended execution order
1. Keep hardening Replay V1 around the current high-value gaps.
2. Design and implement hosted ingest plus server-side match persistence.
3. Replace ship-risk temporary assets.
4. Add deployment and operational hardening.
5. Only then spend serious budget on secondary Stats polish or broader product presentation.

## Decision rule
If a candidate task does not clearly improve either:

- Replay usefulness
- or hosted alpha readiness

it should probably wait.
