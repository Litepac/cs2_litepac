# Mastermind

Trustworthy CS2 2D replay system with a parser-first architecture.

## Read First
- [`AGENTS.md`](c:/Users/rasmu/Desktop/CS2_Litepac/AGENTS.md): repo rules and working constraints
- [`plans.md`](c:/Users/rasmu/Desktop/CS2_Litepac/plans.md): current execution state
- [`docs/README.md`](c:/Users/rasmu/Desktop/CS2_Litepac/docs/README.md): design and implementation docs
- [`docs/08-agent-runbook.md`](c:/Users/rasmu/Desktop/CS2_Litepac/docs/08-agent-runbook.md): local startup, verification, and handoff workflow

## Current Local Workflow
- Preferred local path: run the viewer dev server from `viewer/`; it should spawn the Go parser API and serve the app on `http://127.0.0.1:4173/`
- Fallback path: use `tools/local-parser-bridge.mjs` only when the Go API path is unavailable on this machine
- Always verify parser identity through `/api/health` so future work does not silently attach to the wrong parser process

## Core Commands

### Viewer verification
```powershell
cd viewer
npm.cmd run build
```

### Parser verification
```powershell
cd parser
go test ./...
```

### Local startup and fixture workflow
See [`docs/08-agent-runbook.md`](c:/Users/rasmu/Desktop/CS2_Litepac/docs/08-agent-runbook.md).
