param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^de_[a-z0-9_]+$')]
  [string]$MapId,

  [string]$SteamCsgoRoot = 'C:\Program Files (x86)\Steam\steamapps\common\Counter-Strike Global Offensive\game\csgo',

  [string]$Source2ViewerCli = 'Source2Viewer-CLI',

  [ValidateSet('gltf', 'glb')]
  [string]$Format = 'gltf',

  [string]$TextureDecodeFlags = 'ForceLDR',

  [switch]$ManifestOnly
)

$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$mapVpk = Join-Path $SteamCsgoRoot "maps\$MapId.vpk"
$outputDir = Join-Path $repoRoot "public\maps\$MapId\3d"

if (-not (Test-Path -LiteralPath $mapVpk)) {
  throw "CS2 map package not found: $mapVpk"
}

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

if (-not $ManifestOnly) {
  $command = Get-Command $Source2ViewerCli -ErrorAction SilentlyContinue
  if (-not $command) {
    throw "Source2Viewer-CLI was not found. Install ValveResourceFormat / Source 2 Viewer CLI first, then rerun this script."
  }

  & $command.Source `
    -i $mapVpk `
    -o $outputDir `
    -d `
    --texture_decode_flags $TextureDecodeFlags `
    --gltf_export_format $Format `
    --gltf_export_materials `
    --gltf_textures_adapt

  if ($LASTEXITCODE -ne 0) {
    throw "Source2Viewer-CLI failed with exit code $LASTEXITCODE"
  }
}

$asset = Get-ChildItem -LiteralPath $outputDir -Recurse -File |
  Where-Object { $_.Extension -eq ".$Format" } |
  Sort-Object Length -Descending |
  Select-Object -First 1

if (-not $asset) {
  throw "Source2Viewer-CLI finished, but no .$Format map asset was found in $outputDir"
}

$outputRoot = (Resolve-Path -LiteralPath $outputDir).Path.TrimEnd('\') + '\'
$assetPath = (Resolve-Path -LiteralPath $asset.FullName).Path
if (-not $assetPath.StartsWith($outputRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Exported asset is outside output directory: $assetPath"
}
$relativeAssetPath = $assetPath.Substring($outputRoot.Length).Replace('\', '/')
$manifest = [ordered]@{
  assetPath = $relativeAssetPath
  displayName = $MapId
  exportedAt = (Get-Date).ToUniversalTime().ToString('o')
  source = $mapVpk
  coordinateTransform = [ordered]@{
    scale = 0.0254
    source2ToGltf = 'source2viewer-yzx'
  }
}

$manifestPath = Join-Path $outputDir 'manifest.json'
$manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $manifestPath -Encoding utf8

Write-Host "Exported $MapId assets to $outputDir"
Write-Host "3D manifest: $manifestPath"
