# Real 3D Replay Mode

## Purpose

DemoRead's 3D mode is a simple review view over canonical replay truth. It is not a reconstruction of the CS2 client.

The review surface should make these questions easy to answer:

- Where is each alive player?
- Which direction is each player aiming?
- What utility and gunfire activity is happening in the real map world?
- How does the same moment look from tactical, chase, POV, and free cameras?

Clarity and trustworthy aim matter more than character, hand, or weapon fidelity.

## Availability

The current 3D implementation is a local development review mode.

- It is available only in Vite development builds.
- It is available only while the canonical Replay mode is `Live`.
- Production builds exclude ignored `public/maps/*/3d` exports and tree-shake the Three.js stage.
- Release builds remain 2D-first until map assets have a reproducible licensed provisioning path, bounded delivery size, and measured runtime behavior.

## Truth Boundary

The 3D viewer may present:

- player `x/y/z`
- player `yaw`
- player `pitch`
- player `eyeX/eyeY/eyeZ`
- player side, identity, alive state, scoped state, and zoom level
- utility trajectory and lifecycle positions
- fire footprint samples when present
- bomb, death, hurt, and fire event positions

The parser may retain additional canonical fields such as active weapon and viewmodel settings for other replay consumers. The 3D renderer intentionally does not turn those fields into gun, hand, arm, or character-model presentation.

The 3D viewer must not claim:

- exact player model, agent skin, stance, locomotion, or animation graph
- exact hands, weapon mesh, grip, skin, reload, inspect, bob, or sway
- exact client camera FOV
- exact crosshair, recoil, spread, bullet trajectory, hit path, or wallbang truth

If a visual cannot stay inside this boundary, omit it.

## Presentation Contract

Players are compact procedural markers anchored to canonical `x/y/z`.

- CT and T use distinct side colors.
- Marker rotation uses canonical yaw.
- A line from the marker head uses canonical pitch and yaw to show aim orientation.
- The selected player receives a stronger ring and selection column.
- Labels stay compact, distance-limited, and collision-aware.
- The selected marker is hidden in POV so it cannot obstruct its own camera.

The marker is review UI, not a character simulation. No gun, hands, arms, body rig, sockets, or animation assets are loaded.

Parser-backed gunfire cues use canonical fire events and the firing player's canonical position and yaw. They show cadence and direction only; they are not bullet traces.

Smoke and fire are review volumes. Smokes use the parser-known lifecycle center. Molotov and incendiary rendering uses parser fire footprints when present and falls back to the known center only when footprint truth is unavailable.

## Cameras And Aim

- `Tactical` frames the selected player or a relevant alive-player cluster.
- `Chase` follows from behind the selected player's canonical position and yaw.
- `POV` places the camera at canonical eye position and aims with canonical pitch/yaw.
- `Free` provides mouse-look and keyboard fly controls for map inspection.

POV is available only when eye position, yaw, and pitch are all present. Missing values are never replaced with guessed standing height or level pitch.

Scoped state and zoom level may choose a bounded narrower review FOV, but exact client FOV parity is not claimed. POV and Free use a neutral centered review reticle for orientation only.

Outside POV, the selected player's eye/yaw/pitch may be shown as a thin world-space aim ray. The ray may stop at exported map geometry for review readability, but this is not gameplay line-of-sight or bullet collision truth.

## Map Asset Pipeline

Use Source 2 Viewer / ValveResourceFormat to export a local development map:

```powershell
.\tools\export-source2-map.ps1 -MapId de_mirage
```

The helper writes ignored assets under `public/maps/<mapId>/3d` and a `manifest.json` with the coordinate transform used by the viewer.

Do not check extracted Valve map meshes into git until licensing and storage decisions are explicit. Player, animation, weapon, hand, and viewmodel export helpers are intentionally not part of this pipeline.

Source2Viewer can emit material or light-probe extraction warnings while still producing usable map geometry. Treat visual map-material failures as asset-pipeline issues, not replay truth.

## Architecture

Current ownership:

- `viewer/src/canvas/Replay3DStage.tsx`: replay-to-scene orchestration, procedural markers, aim, camera framing, utilities, and interaction
- `viewer/src/replay3d/stageRuntime.ts`: Three.js scene, renderer, map loading/preparation, camera controls, resize, and deterministic disposal
- `viewer/src/replay3d/resourceDisposal.ts`: shared Three.js resource cleanup
- `viewer/src/replay3d/mapAssetManifest.ts`: development map manifest loading
- `viewer/src/replay3d/replay3dCoordinates.ts`: canonical Source 2 to rendered-world coordinate mapping

The stage remains intentionally small enough to split further only around proven responsibilities. New work should extract utilities/cameras/interactions when that improves ownership, not reintroduce asset-driven character or weapon complexity.

## Verification

Before calling a 3D change usable:

- `npm.cmd test`
- `npm.cmd run build`
- `npm.cmd run check:structure`
- `npm.cmd run check:release`
- verify `/api/health` against the Go parser API
- load a real staged replay and confirm the 3D canvas is nonblank
- compare several known player positions with the 2D radar
- check Tactical, Chase, POV, and Free cameras
- confirm aim changes with replay yaw and pitch
- smoke-test a utility-heavy round
- check map/round switching for stale objects or resource leaks
