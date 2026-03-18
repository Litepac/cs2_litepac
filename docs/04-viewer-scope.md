# 04 Viewer Scope

## V1 Viewer Mission

Render a trustworthy 2D replay from `mastermind.replay.json` with clean controls and correct timing.

## Viewer Inputs

Allowed inputs:

- `mastermind.replay.json`
- static map assets from `assets/maps/`

Disallowed inputs:

- raw `.dem` files
- mock match data
- inferred stats not present in the canonical replay

## V1 Features

### Replay Loading

- load a canonical replay file
- validate the schema before render
- show a clear error if the replay is invalid

### Round Navigation

- list all parsed rounds
- switch rounds directly
- reset playback state on round switch

### Playback

- play and pause
- scrub within the selected round
- preserve demo tick timing
- optionally support a small fixed speed set such as `0.5x`, `1x`, `2x`

### Map Rendering

- top-down radar image
- correct map calibration
- player markers at the right positions
- facing direction indicator
- bomb marker
- utility projectiles and active utility zones

### Selection

- select a player from roster or by clicking a marker
- highlight the selected player on the map
- show only factual per-player details already present in the replay artifact

## Rendering Rules

- replay clock is tick-driven, not animation-frame driven
- rendering interpolates only between adjacent trusted samples from the replay artifact
- the viewer never invents missing positions
- dead players disappear or switch to an explicit dead state only when the replay says so

## Minimal V1 UI Surface

- header with replay metadata
- left panel with round list and player list
- center replay canvas
- bottom timeline and playback controls
- small event strip for kills and bomb state

## Explicitly Out of Scope for V1

- economy analytics
- ratings or advanced stats
- heatmaps
- line-of-sight or x-ray systems
- annotation tools
- collaboration features
- server-side processing inside the viewer

## Viewer Architecture Boundary

React owns:

- file loading
- panels
- controls
- selection state
- current tick and round state

PixiJS owns:

- map texture
- player sprites or vector markers
- utility rendering
- bomb rendering
- timeline overlays tied to replay state
