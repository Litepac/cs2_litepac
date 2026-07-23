# Real 3D Replay Mode

## Target

DemoRead's 3D mode should be a real map-world replay view, not a tilted radar.

The target is:
- a Source 2 map render from CS2 map assets
- live player models/compact markers placed in the real world at canonical `x/y/z`
- utility trajectories drawn through the real world
- an optional 2D tactical radar overlay/cutaway for round context
- existing replay HUD, rosters, killfeed, and timeline retained

This is a separate view over canonical replay truth. It must not become a fake POV system.

## Current Availability

The current 3D implementation is a local development review mode, not a production surface.

- It is available only in Vite development builds.
- It is available only while the canonical Replay mode is `Live`; switching to Utility, Positions, Heatmap, or Death Review returns to 2D.
- Production builds exclude the ignored `public/maps/*/3d` and `public/models` exports and tree-shake the Three.js stage.
- Release builds remain 2D-first until 3D assets have a reproducible licensed provisioning path, bounded delivery size, and measured runtime behavior.

## Current Truth Boundary

Parser-backed now:
- player `x/y/z`
- player `yaw`
- player `pitch`
- player `eyeX/eyeY/eyeZ`
- player alive/health/equipment state
- player scoped state, active weapon zoom level, viewmodel FOV/offset, recoil index, walking/ducking/on-ground flags, and crosshair code when demoinfocs exposes them
- utility trajectory `x/y/z`
- utility phase/event positions
- fire footprint samples for molotov/incendiary when available
- bomb/death/hurt/fire event positions

Missing for exact POV:
- map collision/visibility data
- exact world camera FOV parity for scoped/unscoped client rendering
- exact Source 2 first-person weapon animation, bob/sway, inspect/reload state, recoil camera kick, spread, and hit trajectory truth

Until those exist, label POV as parser-backed eye/view-angle and viewmodel-state review only. A centered POV/free-camera review reticle may be drawn for orientation, but it is not exact CS2 client rendering, player crosshair config, recoil/spread, or bullet truth.

## Asset Pipeline

Local CS2 map packages exist under:

```text
C:\Program Files (x86)\Steam\steamapps\common\Counter-Strike Global Offensive\game\csgo\maps
```

Examples:
- `de_mirage.vpk`
- `de_cache.vpk`
- `de_dust2.vpk`
- `de_inferno.vpk`
- `de_nuke.vpk`
- `de_train.vpk`
- `de_vertigo.vpk`
- `de_ancient.vpk`
- `de_anubis.vpk`
- `de_overpass.vpk`

Use Source 2 Viewer / ValveResourceFormat for extraction. It supports Source 2 VPK browsing and glTF/GLB export for maps/models.

Expected command shape after installing the CLI:

```powershell
Source2Viewer-CLI -i "C:\Program Files (x86)\Steam\steamapps\common\Counter-Strike Global Offensive\game\csgo\maps\de_mirage.vpk" -o ".\public\maps\de_mirage\3d" -d --gltf_export_format gltf
```

Repo helper after the CLI is installed:

```powershell
.\tools\export-source2-map.ps1 -MapId de_mirage
```

Default CS2 player model helper:

```powershell
.\tools\export-source2-player-proxies.ps1
```

Default CS2 weapon model helper:

```powershell
.\tools\export-source2-weapon-models.ps1
```

Default CS2 first-person viewmodel asset helper:

```powershell
.\tools\export-source2-viewmodels.ps1
```

Do not check extracted Valve map meshes into git until licensing/storage decisions are explicit. Prefer generated local artifacts ignored by git for development.

The current helper exports map glTF with material and texture references enabled:

```powershell
--texture_decode_flags ForceLDR --gltf_export_materials --gltf_textures_adapt
```

It writes `public/maps/<mapId>/3d/manifest.json` with the Source2Viewer axis mapping:

```json
{
  "coordinateTransform": {
    "scale": 0.0254,
    "source2ToGltf": "source2viewer-yzx"
  }
}
```

Source2Viewer may emit `exceptions.txt` for some cubemap/light-probe texture extraction failures while still producing usable map glTF geometry. Treat white/magenta materials as an asset-pipeline issue, not replay truth.

The viewer filters exported Source helper materials such as `materials/tools/toolssolidblocklight.vmat` and `materials/tools/toolsblocklight.vmat` because those are editor/render-helper surfaces, not useful replay geography.

The viewer also applies a bounded tactical material pass to exported map materials. Source2Viewer preserves real map texture references, but the exported glTF does not carry CS2's full in-engine lighting/material context, so raw PBR materials can read as a washed-out white model in Three.js. The material pass keeps the exported texture maps and alpha settings, converts the map surface to an unlit review material, and applies conservative material-name tints so Mirage reads like a real tactical world instead of a blank geometry export. This is presentation only; replay positions and event truth still come from canonical parser data.

Direct player-agent extraction tests against public CS2 VPK character files such as `characters/models/ctm_sas/ctm_sas.vmdl_c` and `characters/models/tm_phoenix/tm_phoenix.vmdl_c` produce small default-orange placeholder meshes, not usable agent models. The correct default-agent asset chain comes from `scripts/items/items_game.txt`, where `model_player` points to `agents/models/ctm_sas/ctm_sas.vmdl` and `agents/models/tm_phoenix/tm_phoenix.vmdl`. The local helper exports those compiled resources from `agents/models/ctm_sas/ctm_sas.vmdl_c` and `agents/models/tm_phoenix/tm_phoenix.vmdl_c` into ignored development assets under `public/models/players/default_agents`.

These are real CS2 default CT/T agent models, but they are still default team models. DemoRead must not claim per-player equipped agent skin identity unless parser inventory truth and a matching model export path prove that identity.

The player animation helper exports real CS2 world locomotion `.vnmclip_c` assets as animation-only glTF files under ignored development assets in `public/models/players/default_agents/animations`. Current exported families are pistol, rifle, and knife, with idle plus walk/run clips. The viewer retargets rotation tracks from those clips onto the default CT/T agent skeletons, strips translation/root-motion displacement so parser-owned `x/y/z` remains authoritative, and selects only a conservative weapon-family + idle/walk/run presentation from parser-owned active weapon class and position deltas. Exact strafe/backpedal/crouch/jump blends are intentionally not claimed yet because the canonical replay does not expose trustworthy animation graph state.

This animation binding is presentation, not full CS2 animation-graph truth. DemoRead still must not claim exact crouch/jump/ladder/stance/blend state until the parser exposes trustworthy state for those behaviors.

Default CS2 weapon meshes are exported into ignored development assets under `public/models/weapons/default`. The viewer presents those meshes from parser-owned `activeWeapon`, `activeWeaponClass`, `mainWeapon`, and bomb-carrier state. Model-backed players now prefer the exported `wpn`/`wpnPivot` skeleton sockets so carried weapons stay with the player rig instead of floating as a root-offset prop. This is still bounded review presentation, not an exact CS2 hand grip or weapon animation graph. World weapons are rendered as opaque depth-tested review meshes like player models. If the matching local weapon model is missing or still loading, the weapon visual is omitted rather than replaced with synthetic geometry. This is default weapon identity only: no skins, StatTrak, stickers, exact grip pose, or first-person viewmodel truth is claimed.

Weapon model loading is progressive and limited to weapon keys actually present in the active round. It fetches a bounded number of glTF assets at a time and rebuilds player markers when a real model template arrives. Browser verification should show only requested `/models/weapons/default/.../*.gltf` resources, plus their `.bin` and texture resources, completing without weapon-resource failures. In local Vite dev, the Three.js example modules used by 3D loading are excluded from dependency pre-optimization so a stale optimized `GLTFLoader` cannot leave the viewer in a manifest-only state.

Parser-backed gunfire cues are rendered from canonical `fireEvents`. The viewer draws a short-lived muzzle flash and directional tracer from the firing player's canonical position and yaw so the 3D review has visible shooting cadence. This is not exact bullet or crosshair truth: parser output currently lacks spread, exact recoil camera transform, scoped world-FOV parity, and impact trajectory.

3D player labels, ground rings, bounded character review scale, mesh grounding, and short animation-switch hysteresis are review UI, not gameplay truth. Parser-owned `x/y/z/yaw` still anchors each player, while the rendered default agent mesh uses a bounded position-to-eye scale plus a small 3D-review presentation multiplier because Source2Viewer's exported player glTF and Mirage glTF do not read at the same perceived scale in close review cameras. Labels use a simple screen-space collision pass so the selected player stays visible while overlapping non-selected labels are hidden; rings are only a selection/side readability aid.

Player mesh grounding is presentation-only: model clones are scaled to the review world from parser-owned position-to-eye height when available, using a standing-height ratio based on the normal Source-style eye-to-player-height relationship, then cached exported foot/ankle bones are kept at a small fixed clearance above the parser-owned player origin so close cameras do not make default agents appear half-submerged or floating. A bounded extra visual scale is applied only to the rendered model so close 3D review reads closer to in-game character size; this does not change canonical `x/y/z`.

The 3D shell should stay review-focused rather than debug-heavy: rosters are quieter in 3D mode than in 2D, player labels are compact and distance-limited, rings are subdued, and initial camera framing prefers the selected player or a single team cluster when freeze-time teams are far apart. Tactical framing also refocuses after large timeline seeks so reviewers land near the current action instead of stale freeze-time spawn framing. These camera and UI choices are presentation ergonomics only; they do not add gameplay truth beyond canonical replay positions and view angles.

Close camera presets are allowed only inside that truth boundary. `Tactical` frames the selected player/team cluster, `Chase` follows the selected player's parser-owned `x/y/z/yaw` from a close shoulder-follow angle, `POV` places the camera at parser-owned `eyeX/eyeY/eyeZ` and aims with parser-owned `pitch/yaw`, and `Free` is a review fly camera with mouse look plus WASD movement, Q/E and Space/Ctrl vertical movement, and Shift/Alt speed modifiers. `Chase` uses the same Source2Viewer yaw convention as player/gunfire rendering, tries behind-player candidates, and ray-checks those candidates against exported map meshes so review framing is less likely to start inside walls or foreground props. This is camera ergonomics only, not gameplay line-of-sight truth. `POV` intentionally hides the selected world model and uses a centered review reticle. `Free` also uses a centered review reticle for camera orientation. Outside `POV`, the selected player's parser-owned eye/yaw/pitch can be shown as a thin world-space aim ray/tube with an endpoint that stops at exported map collision; if no explicit selected player exists, the viewer uses the same alive fallback review-player choice used for POV entry. This is a view-angle review aid, not bullet, spread, hit, or wallbang truth. `POV` renders a camera-attached opaque active-weapon or active-utility review model from parser-owned active weapon plus parser-owned viewmodel FOV/offset when available; exported first-person weapon glTFs under `public/models/viewmodels/default` are preferred when they load, then normalized and local-forward canonicalized so raw Source2Viewer scale/axis quirks cannot fill the viewport or point sideways. The matching real world weapon mesh is the only fallback; if neither real asset exists, the weapon is omitted. The local viewmodel helper exports `weapons/models/shared/arms/weapon_arms.vmdl_c` and matching weapon viewmodel glTFs into ignored assets under `public/models/viewmodels/default`. The shared arms rig is loaded only when available and conservatively calibrated; if it is absent or not aligned, POV is allowed to be weapon-only rather than inventing procedural fake hands. Third-person carried weapon meshes are bounds-normalized and socket-attached to the exported player rig where available so raw glTF scale/axis quirks cannot dominate close cameras. Parser pitch is applied as bounded review rotation on visible head/spine/aim-helper bones and carried weapon socket objects, plus a subdued review aim cue for model-backed players when pitch is present; this is not the exact CS2 animation graph. This is not exact Source 2 first-person animation, bob/sway, reload, inspect, recoil, or spread. A POV sample is usable only when canonical eye position, yaw, and pitch are all present; missing values are never replaced with a standing-height or level-pitch guess. Scoped POV uses parser-owned `isScoped`/`zoomLevel` to choose a narrower review camera FOV, but exact CS2 client FOV parity is still unclaimed until validated against real client output. If the selected player lacks a valid alive POV sample, the viewer may choose another alive player only when that player's canonical eye position/yaw/pitch are complete.

Source2Viewer map exports can contain one-sided floor/wall planes that expose black underside voids when a close camera gets too low. The viewer renders prepared map materials double-sided and keeps close camera presets above a minimum vertical clearance. It also hides known decorative foliage/tarp alpha-card exports that render as large black cards in review cameras. This is a review-rendering guard only; it is not map collision or line-of-sight truth.

The exported Mirage scene does not currently include full CS2 sky/lighting fidelity. The viewer uses a neutral review background, hemisphere/key lighting, and texture anisotropy on exported map textures so close tactical camera angles do not read as black voids or smeared floor surfaces. Ground rings are intentionally subdued for model-backed players; they are review selection aids, not gameplay objects.

Some Source2Viewer foliage/decorative materials export as one-sided black cards at close tactical angles. The viewer hides known decorative foliage material signatures during the review material pass. This is an export-presentation cleanup only; it does not remove gameplay collision or alter replay truth.

Smoke and fire in 3D are parser-backed review volumes, not claimed CS2 particle simulation. Smokes use the parser-known detonation/lifecycle center and deterministic neutral puffs/core haze so reviewers can see active occlusion in world space without generating heavy per-tick particle simulation. Fire uses parser `fireFootprint` samples when present, with ground patches/flame markers and light smoke wisps at those cells; fallback center rendering is only used when footprint truth is unavailable.

## Viewer Architecture

Current modules:
- `viewer/src/canvas/Replay3DStage.tsx`
- `viewer/src/replay3d/mapAssetManifest.ts`
- `viewer/src/replay3d/replay3dCoordinates.ts`
- `viewer/src/controls/replay-map-first/ReplayViewModeToggle.tsx`

Current 3D overlays:
- parser-backed player placement from canonical `x/y/z/yaw/pitch/eyeX/eyeY/eyeZ`; when local default-agent assets exist, CT/T players render with the exported CS2 SAS/Phoenix models plus compact review labels, quieter side/selection rings, and parser-selected default weapon meshes, otherwise the viewer falls back to small tactical body markers
- parser-backed utility trajectory lines and endpoint markers from canonical utility trajectory/phase `x/y/z`
- review-rendered 3D utility volumes: smokes use parser-known lifecycle/center with a deterministic neutral cloud, molotov/incendiary uses parser fire footprints when available, and HE/flash use short burst markers
- parser-backed fire-event cues: short muzzle flash and directional tracer from player `x/y/z/yaw`, explicitly not exact bullet/crosshair truth
- parser-backed POV camera from canonical eye position and pitch/yaw plus active-weapon viewmodel review placement from parser-owned active weapon/viewmodel fields; a neutral review reticle and selected/current review-player aim ray can show orientation, but no line-of-sight, exact world FOV, exact first-person animation, recoil/spread, bullet, or exact crosshair-config claims are made

Renderer:
- Use Three.js for the actual 3D scene.
- Load exported GLB map assets.
- Keep the 3D scene full-bleed inside the replay map workspace.
- Use the existing 2D replay as the default until map assets and performance are proven.

Coordinate contract:
- Start by aligning exported map origin/axis to canonical replay coordinates per map.
- Store alignment metadata next to existing `calibration.json`, but keep it separate from 2D radar calibration.
- Add a fixture-based sanity check for known player positions on at least Mirage before expanding maps.

## V0 Scope

1. Install Source 2 Viewer CLI and export one local development map, probably Mirage.
2. Add Three.js and a feature-hidden `Replay3DStage`.
3. Load the GLB map and verify it renders nonblank.
4. Place live players using canonical `x/y/z`.
5. Add basic camera controls:
   - free orbit
   - selected-player follow target
   - top tactical angle
6. Keep default CT/T CS2 player models behind the local ignored asset manifest, and only add exact equipped agents after parser/model truth exists.
7. Add selected-player camera/follow presets.
8. Add a 2D tactical inset/cutaway over the 3D scene.
9. Keep a clear label: `3D Tactical`, not POV.

## Verification

Before calling 3D mode usable:
- `npm.cmd run build`
- `npm.cmd run check:release`
- `npm.cmd run check:structure`
- `npm.cmd test`
- browser screenshot at 1920x1080 and 2560x1440
- nonblank canvas pixel check
- loaded-map memory check after round/map switching
- utility-heavy round playback smoke test
- compare at least five known player positions against 2D radar placement
