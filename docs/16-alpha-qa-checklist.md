# Alpha QA Checklist

Use this checklist before sharing a Cloudflare tunnel or moving a build toward a real domain. It is intentionally product-path focused; use git history for implementation detail.

## Required Local Startup

- Start local dev with `start-localhost.cmd`.
- Verify `http://127.0.0.1:4173/api/health` returns a mode value.
- Prefer `mode: "go-api"` for normal local work.
- Treat `mode: "node-bridge"` as fallback only.
- Start public tunnel with `start-cloudflare.cmd` only after localhost responds.

## Viewports

- Check `1920x1080`.
- Check `1440x900`.
- Check `1366x768`.
- Check one narrow/mobile viewport for navigation, content overflow, and CTA reachability.

## Home

- Page paints without loading demo, parser, replay, or skeleton states.
- DemoRead logo renders without a black rectangle.
- Hero animation respects reduced motion.
- Primary CTA opens Matches.
- Secondary CTA scrolls to the intended flow section.
- Feedback is available from the top shell and is keyboard reachable.

## Matches

- Parser offline state disables upload and shows a useful product-level message.
- Upload Demo opens the file picker from both the top-nav CTA and the Matches header CTA.
- Demo ingest shows truthful stages: upload, parse, validate, index, save.
- Round rack shows real round count as soon as known.
- Round rack progresses in order from active to locked using real parser progress.
- Failed ingest stays inside the DemoRead error component and includes a useful next step.
- Search and map filters update visible results without breaking row layout.
- Open is visually primary compared with Stats and Delete.
- Stats opens the match stats route.
- Delete removes the selected local match without affecting other entries.
- Validation fixtures remain secondary and do not look public-facing.

## Replay Workspace

- Opening a match lands on the current map-first replay page, not a legacy replay shell.
- Home and Matches in the left rail exit replay cleanly.
- Top HUD shows map/round, timer, score, teams, and alive count clearly.
- CT/T roster cards fit at 1080p and show correct weapon/equipment icons.
- Space toggles play/pause unless focus is inside an input or button.
- `M` selects move mode.
- `D` selects drawing mode.
- `C` clears drawing.
- Drawing produces a readable thick annotation line and clear removes it.
- Round selector preserves CT/T winner readability.
- Timeline playhead stays aligned with elapsed progress.
- Timeline event markers are readable at 1080p.
- Bomb phase does not hide playhead or elapsed progress.
- Live / Utility / Paths / Player / Heatmap modes do not invent unavailable data.

## Feedback

- Feedback opens and closes with visible focus.
- Escape closes the feedback panel.
- Submitted feedback includes route/context when available.
- Failure state is readable and does not look like a raw developer error.

## Verification Commands

Run before committing readiness changes:

```powershell
Set-Location viewer
npm.cmd run build
Set-Location ..\parser
go test ./...
```

## Hosted Alpha Blockers

Do not treat a public domain as production-ready until these are intentionally designed:

- Hosted parser/ingest jobs.
- Upload size and type limits.
- Durable replay artifact storage.
- Server-backed match library persistence.
- Session/auth model.
- Rate limiting and abuse protection.
- Production logging and ingest failure observability.
