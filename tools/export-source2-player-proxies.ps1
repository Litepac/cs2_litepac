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
$outputDir = Join-Path $repoRoot 'public\models\players\default_agents'
$models = @(
  @{
    Side = 'ct'
    DisplayName = 'SAS'
    Path = 'agents/models/ctm_sas/ctm_sas.vmdl_c'
  },
  @{
    Side = 't'
    DisplayName = 'Phoenix'
    Path = 'agents/models/tm_phoenix/tm_phoenix.vmdl_c'
  }
)

if (-not (Test-Path -LiteralPath $pakVpk)) {
  throw "CS2 pak package not found: $pakVpk"
}

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

if (-not $ManifestOnly) {
  $command = Get-Command $Source2ViewerCli -ErrorAction SilentlyContinue
  if (-not $command) {
    throw "Source2Viewer-CLI was not found. Install ValveResourceFormat / Source 2 Viewer CLI first, then rerun this script."
  }

  foreach ($model in $models) {
    & $command.Source `
      -i $pakVpk `
      -o $outputDir `
      -d `
      --vpk_filepath $model.Path `
    --texture_decode_flags $TextureDecodeFlags `
    --gltf_export_format $Format `
    --gltf_export_animations `
    --gltf_export_materials `
    --gltf_textures_adapt

    if ($LASTEXITCODE -ne 0) {
      throw "Source2Viewer-CLI failed with exit code $LASTEXITCODE while exporting $($model.Path)"
    }
  }
}

$outputRoot = (Resolve-Path -LiteralPath $outputDir).Path.TrimEnd('\') + '\'
$assetsBySide = @{}

foreach ($model in $models) {
  $expectedName = [System.IO.Path]::GetFileNameWithoutExtension([System.IO.Path]::GetFileNameWithoutExtension($model.Path)) + ".$Format"
  $asset = Get-ChildItem -LiteralPath $outputDir -Recurse -File |
    Where-Object { $_.Name -eq $expectedName } |
    Select-Object -First 1

  if (-not $asset) {
    throw "Source2Viewer-CLI finished, but no .$Format asset was found for $($model.Path) in $outputDir"
  }

  $assetPath = (Resolve-Path -LiteralPath $asset.FullName).Path
  if (-not $assetPath.StartsWith($outputRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Exported asset is outside output directory: $assetPath"
  }

  $assetsBySide[$model.Side] = @{
    AssetPath = $assetPath.Substring($outputRoot.Length).Replace('\', '/')
    Source = "$pakVpk::$($model.Path)"
  }
}
$manifest = [ordered]@{
  ctAssetPath = $assetsBySide.ct.AssetPath
  tAssetPath = $assetsBySide.t.AssetPath
  displayName = 'CS2 default SAS/Phoenix agent models'
  exportedAt = (Get-Date).ToUniversalTime().ToString('o')
  ctSource = $assetsBySide.ct.Source
  tSource = $assetsBySide.t.Source
  truthBoundary = 'Default CS2 CT/T agent models from items_game model_player paths. DemoRead does not claim per-player equipped agent skin identity until parser inventory truth exists.'
}

$manifestPath = Join-Path $outputDir 'manifest.json'
$manifestJson = $manifest | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText($manifestPath, $manifestJson, [System.Text.UTF8Encoding]::new($false))

Write-Host "Exported CS2 default agent assets to $outputDir"
Write-Host "3D player model manifest: $manifestPath"
