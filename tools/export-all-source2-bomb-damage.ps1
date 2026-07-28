param(
  [string[]]$MapIds = @(
    'de_ancient',
    'de_anubis',
    'de_cache',
    'de_dust2',
    'de_inferno',
    'de_mirage',
    'de_nuke',
    'de_overpass',
    'de_train',
    'de_vertigo'
  ),
  [switch]$ReplaceExisting
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$singleMapExporter = Join-Path $PSScriptRoot 'export-source2-bomb-damage.ps1'

foreach ($mapId in $MapIds) {
  $manifestPath = Join-Path $repoRoot "public\maps\$mapId\bomb-damage\manifest.json"
  if ((Test-Path -LiteralPath $manifestPath) -and -not $ReplaceExisting) {
    Write-Host "Keeping existing $mapId field and demo allowlist."
    continue
  }

  if ($ReplaceExisting -and (Test-Path -LiteralPath $manifestPath)) {
    Write-Warning "Replacing $mapId clears its demo allowlist until a fresh compatible demo is supplied."
  }

  & $singleMapExporter -MapId $mapId
  if ($LASTEXITCODE -ne 0) {
    throw "Bomb-field extraction failed for $mapId."
  }
}

Write-Host ''
Write-Host 'Current local bomb-field inventory:'
foreach ($mapId in $MapIds) {
  $manifestPath = Join-Path $repoRoot "public\maps\$mapId\bomb-damage\manifest.json"
  if (-not (Test-Path -LiteralPath $manifestPath)) {
    Write-Host "$mapId missing"
    continue
  }

  $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
  $ranges = ($manifest.sites | ForEach-Object { "$($_.label)=$($_.propagationRange)" }) -join ', '
  Write-Host "$mapId resource=$($manifest.resource.sha256) demos=$($manifest.compatibleSourceDemoSha256.Count) ranges=[$ranges]"
}
