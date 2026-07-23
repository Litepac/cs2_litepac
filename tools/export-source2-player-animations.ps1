param(
  [string]$SteamCsgoRoot = 'C:\Program Files (x86)\Steam\steamapps\common\Counter-Strike Global Offensive\game\csgo',

  [string]$Source2ViewerCli = 'Source2Viewer-CLI',

  [ValidateSet('gltf', 'glb')]
  [string]$Format = 'gltf',

  [string]$TextureDecodeFlags = 'ForceLDR',

  [switch]$ManifestOnly
)

$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$pakVpk = Join-Path $SteamCsgoRoot 'pak01_dir.vpk'
$outputDir = Join-Path $repoRoot 'public\models\players\default_agents\animations'
$families = @('pistol', 'rifle', 'knife')
$directions = @('n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw')
$clips = @()

foreach ($family in $families) {
  $basePath = "animation/anims/world/$family/_default_$family"
  $clips += @{
    Key = "$family`_idle"
    Family = $family
    Motion = 'idle'
    Direction = 'n'
    Path = "$basePath/idle_$family.vnmclip_c"
  }

  foreach ($motion in @('walk', 'run')) {
    foreach ($direction in $directions) {
      $clips += @{
        Key = "$family`_$motion`_$direction"
        Family = $family
        Motion = $motion
        Direction = $direction
        Path = "$basePath/$motion`_$direction`_$family.vnmclip_c"
      }
    }
  }
}

if (-not (Test-Path -LiteralPath $pakVpk)) {
  throw "CS2 pak package not found: $pakVpk"
}

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

if (-not $ManifestOnly) {
  $command = Get-Command $Source2ViewerCli -ErrorAction SilentlyContinue
  if (-not $command) {
    throw "Source2Viewer-CLI was not found. Install ValveResourceFormat / Source 2 Viewer CLI first, then rerun this script."
  }

  foreach ($clip in $clips) {
    & $command.Source `
      -i $pakVpk `
      -o $outputDir `
      -d `
      --vpk_filepath $clip.Path `
      --texture_decode_flags $TextureDecodeFlags `
      --gltf_export_format $Format `
      --gltf_export_animations

    if ($LASTEXITCODE -ne 0) {
      throw "Source2Viewer-CLI failed with exit code $LASTEXITCODE while exporting $($clip.Path)"
    }
  }
}

$outputRoot = (Resolve-Path -LiteralPath $outputDir).Path.TrimEnd('\') + '\'
$clipsByKey = [ordered]@{}
$sourcesByKey = [ordered]@{}

foreach ($clip in $clips) {
  $expectedName = [System.IO.Path]::GetFileNameWithoutExtension([System.IO.Path]::GetFileNameWithoutExtension($clip.Path)) + ".$Format"
  $asset = Get-ChildItem -LiteralPath $outputDir -Recurse -File |
    Where-Object { $_.Name -eq $expectedName } |
    Select-Object -First 1

  if (-not $asset) {
    throw "Source2Viewer-CLI finished, but no .$Format asset was found for $($clip.Path) in $outputDir"
  }

  $assetPath = (Resolve-Path -LiteralPath $asset.FullName).Path
  if (-not $assetPath.StartsWith($outputRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Exported asset is outside output directory: $assetPath"
  }

  $clipsByKey[$clip.Key] = [ordered]@{
    assetPath = $assetPath.Substring($outputRoot.Length).Replace('\', '/')
    family = $clip.Family
    motion = $clip.Motion
    direction = $clip.Direction
  }
  $sourcesByKey[$clip.Key] = "$pakVpk::$($clip.Path)"
}

$manifest = [ordered]@{
  animationClips = $clipsByKey
  animationSources = $sourcesByKey
  displayName = 'CS2 default world locomotion clips'
  exportedAt = (Get-Date).ToUniversalTime().ToString('o')
  truthBoundary = 'Worldmodel locomotion clips exported from local CS2 Source 2 assets. DemoRead selects clips from parser-owned positions/yaw for presentation and does not claim exact animation graph state.'
}

$manifestPath = Join-Path $outputDir 'manifest.json'
$manifestJson = $manifest | ConvertTo-Json -Depth 8
[System.IO.File]::WriteAllText($manifestPath, $manifestJson, [System.Text.UTF8Encoding]::new($false))

Write-Host "Exported CS2 world locomotion clips to $outputDir"
Write-Host "3D player animation manifest: $manifestPath"
