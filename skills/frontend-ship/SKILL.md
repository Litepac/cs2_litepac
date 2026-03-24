---
name: frontend-ship
description: Build or refine production-ready frontend UI for this repo. Use when the task is about screens, components, layout, interaction design, polish, visual hierarchy, responsiveness, accessibility, or release-quality frontend improvement in the viewer shell, Home, Matches, ingest flows, or replay-adjacent UI. Do not use for parser semantics, schema design, or canonical replay contract changes.
---

# Frontend Ship Skill

## Goal
Build frontend UI that feels release-capable, visually deliberate, and specific to this CS2 replay product.

## Use This Skill When
- creating a new page or flow
- improving an existing screen
- polishing visual hierarchy
- making a page feel premium instead of template-like
- improving interaction quality
- making the UI responsive and accessible
- turning a rough page into something that can plausibly ship

## Do Not Use This Skill When
- changing parser behavior
- changing schema or canonical replay semantics
- inventing replay or stat truth the parser does not provide
- filling space with fake metrics, fake states, or generic marketing fluff

## Hard Rules
- Start by identifying the primary job of the screen.
- Keep the first viewport focused.
- Keep one obvious primary action per screen.
- Prefer stronger hierarchy over more elements.
- Do not introduce extra widgets unless they directly improve the screen.
- Use the repo's product identity and avoid generic SaaS aesthetics.
- Include loading, empty, and error states when relevant.
- Check keyboard and focus behavior for interactive elements.
- Keep typography scale intentional.
- Use color sparingly and with purpose.
- When choosing between flashy and clear, choose clear.
- Do not introduce UI that implies replay or stat truth the parser or canonical artifact does not provide.

## Repo-Specific Defaults
- Treat `.github/agents/ui-ux-specialist.md` and `.github/agents/frontend-specialist.md` as the local quality bar.
- Keep replay screens map-first and timeline-aware.
- Keep Home welcoming and oriented.
- Keep Matches operational and library-first.
- Keep stats subordinate to replay understanding.
- Keep the UI usable on laptop-sized screens.

## Workflow
1. Inspect the existing code, styles, and the relevant repo-local UI guides.
2. State the intended structure in 5-10 lines max.
3. Implement the screen or component.
4. Self-review:
   - Is the hierarchy strong?
   - Is the primary action obvious?
   - Does it respect parser-first truth boundaries?
   - Does it feel premium instead of template-like?
   - Is there unnecessary clutter?
   - Does it handle empty, loading, and error states?
   - Is it responsive enough?
5. Improve the weakest part before finishing.
6. Update `plans.md` if the workflow or UI direction changes materially.

## Output Expectations
- production-leaning code
- clean component boundaries
- no obvious placeholder styling
- no generic dashboard drift
- no unexplained design randomness

## Repo-Specific UI Tone
Think:
- premium tactical software
- trustworthy replay analysis
- restrained, sharp, dark
- more Skybox/Noesis quality bar than generic admin template

## Trigger Phrases
- make this page feel premium
- redesign this screen
- polish the UI
- ship-ready frontend
- improve hierarchy
- build this replay page
- make this production-ready
