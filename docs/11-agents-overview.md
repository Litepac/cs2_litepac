# Agents Overview

This repo uses "agents" as operating roles and instruction layers, not as separate running services.

They exist to keep work consistent across parser, viewer, validation, and documentation tasks.

## What An Agent Is

In this project, an agent is:
- a set of instructions
- a workflow boundary
- a quality bar for a specific kind of work

An agent is not:
- a background process
- a deployed service
- an autonomous worker outside the repo

The agent system helps answer:
- what should be prioritized
- what should be avoided
- what files should be updated
- how work should be validated

## Agent Layers

The repo has three practical layers.

### 1. Root Policy

[AGENTS.md](/c:/Users/rasmu/Desktop/CS2_Litepac/AGENTS.md) is the top-level contract.

It defines:
- mission
- parser-first workflow
- truth boundaries
- planning expectations
- delivery discipline

Everything else refines this file. Nothing should bypass it.

### 2. Specialist Guides

The specialist guides live in [.github/agents](/c:/Users/rasmu/Desktop/CS2_Litepac/.github/agents).

Current guides:
- [README.md](/c:/Users/rasmu/Desktop/CS2_Litepac/.github/agents/README.md)
- [go-parser-specialist.md](/c:/Users/rasmu/Desktop/CS2_Litepac/.github/agents/go-parser-specialist.md)
- [frontend-specialist.md](/c:/Users/rasmu/Desktop/CS2_Litepac/.github/agents/frontend-specialist.md)
- [ui-ux-specialist.md](/c:/Users/rasmu/Desktop/CS2_Litepac/.github/agents/ui-ux-specialist.md)
- [validation-specialist.md](/c:/Users/rasmu/Desktop/CS2_Litepac/.github/agents/validation-specialist.md)
- [build-ci-specialist.md](/c:/Users/rasmu/Desktop/CS2_Litepac/.github/agents/build-ci-specialist.md)
- [agent-writer-specialist.md](/c:/Users/rasmu/Desktop/CS2_Litepac/.github/agents/agent-writer-specialist.md)

These are used when work matches a specific area.

Examples:
- parser changes: use the parser specialist
- shell/layout work: use frontend + UI/UX specialists
- replay/schema correctness: use validation specialist
- repo docs/process changes: use agent-writer specialist

### 3. Execution State

[plans.md](/c:/Users/rasmu/Desktop/CS2_Litepac/plans.md) tracks what is actually happening now.

It answers:
- what is planned
- what is in progress
- what is done
- what is blocked

This is the bridge between the static instructions and the active work.

## How They Work Together

```text
User request
   |
   v
AGENTS.md
   |
   +--> plans.md
   |
   +--> .github/agents/go-parser-specialist.md
   +--> .github/agents/frontend-specialist.md
   +--> .github/agents/ui-ux-specialist.md
   +--> .github/agents/validation-specialist.md
   +--> .github/agents/build-ci-specialist.md
   +--> .github/agents/agent-writer-specialist.md
   |
   v
Code changes
   |
   v
Validation / build / fixture checks
   |
   v
plans.md + docs updated
```

## Practical Use In This Repo

### Parser Work

Typical path:
- read [AGENTS.md](/c:/Users/rasmu/Desktop/CS2_Litepac/AGENTS.md)
- read [plans.md](/c:/Users/rasmu/Desktop/CS2_Litepac/plans.md)
- apply parser specialist
- apply validation specialist
- update canonical replay or parser logic
- run parser tests / fixture generation
- update docs or plans if workflow changed

### Viewer Work

Typical path:
- read [AGENTS.md](/c:/Users/rasmu/Desktop/CS2_Litepac/AGENTS.md)
- read [plans.md](/c:/Users/rasmu/Desktop/CS2_Litepac/plans.md)
- apply frontend specialist
- apply UI/UX specialist
- compare against reference direction
- remove uncertain visuals rather than guessing
- run viewer build
- update docs or plans if direction changed

### Validation Work

Typical path:
- verify parser output before changing viewer assumptions
- check canonical replay schema
- check staged fixtures
- prefer trustworthy omission over wrong display

## Core Rule

The most important rule is:

```text
Parser and canonical replay own truth.
Viewer maps and presents that truth.
If a visual is uncertain, remove it.
```

That rule exists because UI convenience kept pulling the project away from trustworthy replay behavior.

## Why This Matters

Without the agent system, work drifts into:
- UI guesses instead of parser truth
- undocumented workflow changes
- repeated regressions
- context living only in chat history

With the agent system, the repo itself explains:
- how work should be done
- which specialist guide applies
- where project direction lives

## Related Docs

- [AGENTS.md](/c:/Users/rasmu/Desktop/CS2_Litepac/AGENTS.md)
- [plans.md](/c:/Users/rasmu/Desktop/CS2_Litepac/plans.md)
- [08-agent-runbook.md](/c:/Users/rasmu/Desktop/CS2_Litepac/docs/08-agent-runbook.md)
- [09-ui-ux-direction.md](/c:/Users/rasmu/Desktop/CS2_Litepac/docs/09-ui-ux-direction.md)
- [10-prior-art-review.md](/c:/Users/rasmu/Desktop/CS2_Litepac/docs/10-prior-art-review.md)
- [.github/agents/README.md](/c:/Users/rasmu/Desktop/CS2_Litepac/.github/agents/README.md)
