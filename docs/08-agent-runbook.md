# Agent Runbook

## Purpose
This file is the practical continuation guide for future work in this repository.

Use it when:
- continuing implementation after a pause
- debugging viewer regressions
- validating parser/viewer changes against real demos
- handing off work between sessions

## Core Rules
- Respect `AGENTS.md` first
- Keep `plans.md` current
- Treat `plans.md` as an operator file: one active path in `In Progress`, short upcoming queue in `Planned`, and milestone-level history in `Done`
- Do not add fake replay data to unblock UI work
- Validate parser output before changing viewer interpretation
- Prefer localized fixes over broad visual experiments

## Current Safe Workflow
1. Parse real demos into canonical replay files
2. Stage replay fixtures into `assets/fixtures`
3. Open the viewer on real staged replay data
4. Compare specific rounds against observed demo behavior
5. Fix either parser semantics or viewer interpretation, not both blindly

## Local Startup Rules
- When the user says "start everything up", start the local viewer/parser first, then start a Cloudflare quick tunnel to `http://127.0.0.1:4173`, and keep the `friend-logs/` tails available if friend-testing activity needs to be observed.
- Default dev path: run the viewer dev server from `viewer/`. `viewer/vite.config.ts` is expected to spawn the Go parser API from `parser/cmd/mastermind-api`.
- Fallback path: use `tools/local-parser-bridge.mjs` only if the Go API path is unavailable on the current machine. That bridge serves the same local API surface on `127.0.0.1:4318`, shells out to `parser/fixtureparse.exe`, and should still stream real round progress when `fixtureparse` supports NDJSON progress.
- Before debugging ingest, call `/api/health` through the active viewer URL and check `mode`: `go-api` is the preferred direct parser runtime, `node-bridge` is the fallback bridge.
- Do not make a new chat invent a third startup path. If parser startup behavior is wrong, fix or document one of these two paths instead.

## Commands

### Start viewer + default parser API
```powershell
cd viewer
npm.cmd run dev -- --host 127.0.0.1 --port 4173
```

The `dev` script uses Vite's native config loader on this machine. In the ideal path, `viewer/vite.config.ts` starts the Go parser API child automatically.

### Start viewer + fallback parser bridge in one command
```powershell
cd viewer
npm.cmd run dev:local
```

Use this on the current machine when you want the known-good local launcher. It starts the direct Go API when available and falls back to the Node parser bridge on `127.0.0.1:4318` if needed, so `/api/health` still resolves through the viewer dev server on `127.0.0.1:4173`. `npm.cmd run dev:bridge` remains as a compatibility alias.

### Start localhost from repo root
```powershell
.\start-localhost.cmd
```

Use this as the default operator shortcut on this machine. It clears stale localhost temp logs, opens a dedicated console window, and runs the known-good local path for you without tying up the current shell.

### Start Cloudflare tunnel for friend testing
```powershell
cd c:\Users\rasmu\Desktop\CS2_Litepac
& "$env:USERPROFILE\cloudflared\cloudflared.exe" tunnel --url http://127.0.0.1:4173
```

Cloudflare prints a temporary `trycloudflare.com` URL in that terminal. Expect a new URL each time the quick tunnel is restarted.

Root shortcut:
```powershell
.\start-cloudflare.cmd
```

Run `.\start-localhost.cmd` first, then run this Cloudflare shortcut in a second terminal/window. The shortcut checks that `http://127.0.0.1:4173` is reachable before starting the tunnel and then tells you to copy the printed `https://*.trycloudflare.com` URL.

### Check parser API identity
```powershell
(Invoke-WebRequest -UseBasicParsing http://127.0.0.1:4173/api/health).Content
```

### Watch local tunnel usage events
```powershell
Get-Content -Path .\friend-logs\usage.log -Tail 40 -Wait
```

### Watch local feedback submissions
```powershell
Get-Content -Path .\friend-logs\feedback.log -Tail 40 -Wait
```

### Read feedback from the machine log
```powershell
Get-Content -Path .\friend-logs\feedback.log -Tail 40
```

### Fallback local parser bridge
```powershell
cd parser
go build -o fixtureparse.exe .\cmd\fixtureparse
cd ..
node tools\local-parser-bridge.mjs
```

### Parse fixtures
```powershell
cd parser
go run .\cmd\fixtureparse
```

### Stage fixtures for the viewer
```powershell
cd parser
go run .\cmd\fixturestage
```

### Parser verification
```powershell
cd parser
go test ./...
```

### Viewer verification
```powershell
cd viewer
npm.cmd run build
```

## Current Truth Sources
- Architecture/contracts: `docs/01-05`
- Current implementation state: `docs/06-current-status.md`
- Viewer direction: `docs/07-viewer-roadmap.md`
- Execution state: `plans.md`

## Known Sensitive Areas

### 1. Map projection
- The stable state is full-radar fit with centered projection
- Previous crop/projection experiments caused visible regressions
- Do not reintroduce auto-crop logic casually

### 2. Player aim vectors
- Current rendering may still be semantically wrong
- If facing lines look wrong, verify yaw meaning before changing styling again
- Treat this as a parser/viewer truth-check issue, not a pure CSS issue

### 3. Utility trajectories
- The user wants full visible grenade paths similar in spirit to Skybox
- If trajectories are missing, check:
  - `sampleIntervalTicks`
  - `sampleOriginTick`
  - trajectory sample coverage
  - world-to-screen filtering
  - whether history rendering is being prematurely skipped

### 4. Timeline quality
- The dock is functional but still below target quality
- Prefer improving structure and readability over adding more categories

### 5. Visual clutter
- Label overlap, utility badges, timers, and paths can conflict
- Reduce clutter by prioritizing placement and layering before removing real information

## Preferred Debug Order

### If the issue is visual correctness
1. Confirm the replay JSON has the expected data
2. Confirm the viewer is using that data as intended
3. Only then refine styling

### If the issue is missing data
1. Inspect parser output in `testdata/replays`
2. Check whether the canonical schema already allows the needed field
3. Update parser extraction only if the source demo data is actually reliable

## What To Avoid
- Do not use mock data to test viewer ideas
- Do not quietly reinterpret uncertain data as certain UI
- Do not let the viewer start consuming raw `.dem`
- Do not rewrite large stable areas just to chase a visual reference

## Current Best Next Steps
- Finish reliable full-trajectory utility rendering
- Truth-check player facing vectors against real demo playback
- Improve operator-dock hierarchy and density
- Continue reducing on-map clutter under dense fights
