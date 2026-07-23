param(
  [string]$MapId = 'de_mirage',
  [string]$DemoSha256 = '',
  [string]$VpkPath = '',
  [string]$Source2ViewerCli = '',
  [string]$OutputDir = ''
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot

if ([string]::IsNullOrWhiteSpace($VpkPath)) {
  $VpkPath = "C:\Program Files (x86)\Steam\steamapps\common\Counter-Strike Global Offensive\game\csgo\maps\$MapId.vpk"
}
if ([string]::IsNullOrWhiteSpace($Source2ViewerCli)) {
  $Source2ViewerCli = Join-Path $PSScriptRoot 'source2viewer-cli\Source2Viewer-CLI.exe'
}
if ([string]::IsNullOrWhiteSpace($OutputDir)) {
  $OutputDir = Join-Path $repoRoot "public\maps\$MapId\bomb-damage"
}

$calibrationPath = Join-Path $repoRoot "public\maps\$MapId\calibration.json"
$radarPath = Join-Path $repoRoot "public\maps\$MapId\radar.png"
foreach ($requiredPath in @($VpkPath, $Source2ViewerCli, $calibrationPath, $radarPath)) {
  if (-not (Test-Path -LiteralPath $requiredPath)) {
    throw "Required input was not found: $requiredPath"
  }
}

$tempRoot = [IO.Path]::GetFullPath((Join-Path ([IO.Path]::GetTempPath()) "cs2-litepac-bomb-$([Guid]::NewGuid().ToString('N'))"))
$systemTempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
if (-not $tempRoot.StartsWith($systemTempRoot, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Refusing to use temp directory outside the system temp root: $tempRoot"
}

New-Item -ItemType Directory -Path $tempRoot | Out-Null
try {
  $resourcePath = "maps/$MapId/baked_bomb_damage.vdata_c"
  & $Source2ViewerCli -i $VpkPath -o $tempRoot -f $resourcePath
  if ($LASTEXITCODE -ne 0) {
    throw "Source2Viewer failed while extracting the compiled bomb resource."
  }

  & $Source2ViewerCli -i $VpkPath -o $tempRoot -d -f $resourcePath
  if ($LASTEXITCODE -ne 0) {
    throw "Source2Viewer failed while decompiling the bomb resource."
  }

  $compiledPath = Join-Path $tempRoot "maps\$MapId\baked_bomb_damage.vdata_c"
  $decompiledPath = Join-Path $tempRoot "maps\$MapId\baked_bomb_damage.vdata"
  $nodeArgs = @(
    (Join-Path $PSScriptRoot 'export-bomb-damage-field.mjs'),
    '--input', $decompiledPath,
    '--compiled', $compiledPath,
    '--calibration', $calibrationPath,
    '--radar', $radarPath,
    '--output', $OutputDir,
    '--map', $MapId
  )
  if (-not [string]::IsNullOrWhiteSpace($DemoSha256)) {
    $nodeArgs += @('--demo-sha256', $DemoSha256)
  }
  & node $nodeArgs
  if ($LASTEXITCODE -ne 0) {
    throw "Bomb-field asset generation failed."
  }

  $manifestPath = Join-Path $OutputDir 'manifest.json'
  $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
  Write-Host "Wrote $MapId bomb field from resource $($manifest.resource.sha256)"
  Write-Host "Output: $OutputDir"
}
finally {
  if (Test-Path -LiteralPath $tempRoot) {
    $resolvedTempRoot = [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $tempRoot).Path)
    if (-not $resolvedTempRoot.StartsWith($systemTempRoot, [StringComparison]::OrdinalIgnoreCase)) {
      throw "Refusing to remove temp directory outside the system temp root: $resolvedTempRoot"
    }
    Remove-Item -LiteralPath $resolvedTempRoot -Recurse -Force
  }
}
