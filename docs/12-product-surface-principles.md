# 12 Product Surface Principles

## Purpose
This document is the short working version of the product direction.

It exists to keep the repo aligned on:
- what product we are building
- what each major surface is for
- how those surfaces should behave
- what the current highest-level product priorities are

This is not the place for long-form vision writing or brainstorming.
Longer narrative context should live outside the repo.

## Product North Star
CS2 Litepac is becoming a CS2 analysis product built around three core user-facing surfaces:
- Matches
- 2D Replay
- Stats

The longer-term ambition is closer to "Warcraft Logs for CS" than a pretty demo viewer.

That means the product should eventually support:
- deeper player and team analysis
- replay linked to meaningful events
- better context for why rounds and fights played out the way they did
- richer filtering, comparison, and prep workflows

## Surface Roles

### Home
Home is the branded product surface.

It should:
- sell the product direction inside the app
- feel premium, calm, and deliberate
- use top navigation
- avoid dashboard drift

It should not:
- behave like a working surface
- feel like a generic SaaS homepage

### Matches
Matches is the library surface.

It should:
- be library-first
- focus on browsing local demos and opening work
- keep upload as a compact action, not a hero block
- feel clean, fast, and tool-like
- use top navigation

It should not:
- overload the user with explanatory content
- compete with replay or stats for analytical depth

### Replay
Replay is the operator workspace.

It should:
- be map-first
- feel like a serious review console
- keep navigation and replay tools compact and purposeful
- use a left workspace rail where density helps
- treat the bottom area as a replay transport/timeline surface

It should not:
- feel like a branded landing page
- let rails and panels compete with the map

### Stats
Stats is the dense analysis surface.

It should:
- be table-first
- use desktop space aggressively and intelligently
- feel like a serious analytical tool
- favor scanability and information density over decorative layout
- make rounds breakdown and team tables work together as one analysis surface

It should not:
- become a widget dashboard
- feel airy or hero-like
- rely on speculative or fake stats

## Product Philosophy
- Build purpose-built surfaces, not one generic shell repeated four times.
- Keep the product dark, premium, restrained, and useful.
- Let parser truth drive the replay and stats experience.
- If a stat or visual is uncertain, omit it.
- Prefer dense, readable analytical layouts over decorative empty space.

## Current Product Priorities
1. Tighten the replay bottom area into a stronger, clearer transport/timeline tool.
2. Continue improving the stats destination into a denser desktop analysis surface.
3. Keep Matches and Replay tightly connected so the library-to-analysis workflow feels natural.
4. Preserve a coherent visual family across Home, Matches, Replay, and Stats without making them behave the same way.

## Boundary With Other Repo Docs
- `AGENTS.md` defines workflow and truth rules.
- `plans.md` tracks active execution.
- `docs/09-ui-ux-direction.md` covers replay-oriented UI direction.
- `docs/10-prior-art-review.md` records external reference boundaries.

This document only captures durable product-surface intent.
