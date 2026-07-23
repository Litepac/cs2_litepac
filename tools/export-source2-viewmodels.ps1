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
$outputDir = Join-Path $repoRoot 'public\models\viewmodels\default'
$arms = @{ Key = 'arms'; DisplayName = 'Shared first-person arms'; Path = 'weapons/models/shared/arms/weapon_arms.vmdl_c' }
$models = @(
  @{ Key = 'ak47'; DisplayName = 'AK-47'; Path = 'weapons/models/ak47/weapon_rif_ak47.vmdl_c' },
  @{ Key = 'awp'; DisplayName = 'AWP'; Path = 'weapons/models/awp/weapon_snip_awp.vmdl_c' },
  @{ Key = 'm4a4'; DisplayName = 'M4A4'; Path = 'weapons/models/m4a4/weapon_rif_m4a4.vmdl_c' },
  @{ Key = 'm4a1silencer'; DisplayName = 'M4A1-S'; Path = 'weapons/models/m4a1_silencer/weapon_rif_m4a1_silencer.vmdl_c' },
  @{ Key = 'deagle'; DisplayName = 'Desert Eagle'; Path = 'weapons/models/deagle/weapon_pist_deagle.vmdl_c' },
  @{ Key = 'glock18'; DisplayName = 'Glock-18'; Path = 'weapons/models/glock18/weapon_pist_glock18.vmdl_c' },
  @{ Key = 'hkp2000'; DisplayName = 'P2000'; Path = 'weapons/models/hkp2000/weapon_pist_hkp2000.vmdl_c' },
  @{ Key = 'uspsilencer'; DisplayName = 'USP-S'; Path = 'weapons/models/usp_silencer/weapon_pist_usp_silencer.vmdl_c' },
  @{ Key = 'elite'; DisplayName = 'Dual Berettas'; Path = 'weapons/models/elite/weapon_pist_elite.vmdl_c' },
  @{ Key = 'galilar'; DisplayName = 'Galil AR'; Path = 'weapons/models/galilar/weapon_rif_galilar.vmdl_c' },
  @{ Key = 'famas'; DisplayName = 'FAMAS'; Path = 'weapons/models/famas/weapon_rif_famas.vmdl_c' },
  @{ Key = 'mp9'; DisplayName = 'MP9'; Path = 'weapons/models/mp9/weapon_smg_mp9.vmdl_c' },
  @{ Key = 'mac10'; DisplayName = 'MAC-10'; Path = 'weapons/models/mac10/weapon_smg_mac10.vmdl_c' },
  @{ Key = 'p250'; DisplayName = 'P250'; Path = 'weapons/models/p250/weapon_pist_p250.vmdl_c' },
  @{ Key = 'knife_default_ct'; DisplayName = 'Default CT Knife'; Path = 'weapons/models/knife/knife_default_ct/weapon_knife_default_ct.vmdl_c' },
  @{ Key = 'knife_default_t'; DisplayName = 'Default T Knife'; Path = 'weapons/models/knife/knife_default_t/weapon_knife_default_t.vmdl_c' },
  @{ Key = 'hegrenade'; DisplayName = 'HE Grenade'; Path = 'weapons/models/grenade/hegrenade/weapon_hegrenade.vmdl_c' },
  @{ Key = 'flashbang'; DisplayName = 'Flashbang'; Path = 'weapons/models/grenade/flashbang/weapon_flashbang.vmdl_c' },
  @{ Key = 'smokegrenade'; DisplayName = 'Smoke Grenade'; Path = 'weapons/models/grenade/smokegrenade/weapon_smokegrenade.vmdl_c' },
  @{ Key = 'molotov'; DisplayName = 'Molotov'; Path = 'weapons/models/grenade/molotov/weapon_molotov.vmdl_c' },
  @{ Key = 'incendiarygrenade'; DisplayName = 'Incendiary Grenade'; Path = 'weapons/models/grenade/incendiary/weapon_incendiarygrenade.vmdl_c' },
  @{ Key = 'c4'; DisplayName = 'C4'; Path = 'weapons/models/c4/weapon_c4.vmdl_c' }
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

  $exportTargets = @($arms) + $models
  foreach ($model in $exportTargets) {
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

function Resolve-ExportedAssetPath {
  param(
    [Parameter(Mandatory = $true)] [hashtable]$Model,
    [Parameter(Mandatory = $true)] [string]$Extension
  )

  $expectedName = [System.IO.Path]::GetFileNameWithoutExtension([System.IO.Path]::GetFileNameWithoutExtension($Model.Path)) + ".$Extension"
  $asset = Get-ChildItem -LiteralPath $outputDir -Recurse -File |
    Where-Object { $_.Name -eq $expectedName } |
    Select-Object -First 1

  if (-not $asset) {
    throw "Source2Viewer-CLI finished, but no .$Extension asset was found for $($Model.Path) in $outputDir"
  }

  $assetPath = (Resolve-Path -LiteralPath $asset.FullName).Path
  if (-not $assetPath.StartsWith($outputRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Exported asset is outside output directory: $assetPath"
  }

  return $assetPath.Substring($outputRoot.Length).Replace('\', '/')
}

$weaponAssetPaths = [ordered]@{}
$weaponSources = [ordered]@{}

foreach ($model in $models) {
  $weaponAssetPaths[$model.Key] = Resolve-ExportedAssetPath -Model $model -Extension $Format
  $weaponSources[$model.Key] = "$pakVpk::$($model.Path)"
}

$manifest = [ordered]@{
  armsAssetPath = Resolve-ExportedAssetPath -Model $arms -Extension $Format
  armsSource = "$pakVpk::$($arms.Path)"
  weaponAssetPaths = $weaponAssetPaths
  weaponSources = $weaponSources
  displayName = 'CS2 default first-person viewmodel assets'
  exportedAt = (Get-Date).ToUniversalTime().ToString('o')
  truthBoundary = 'Default CS2 first-person shared arms and weapon meshes from local Source 2 assets. DemoRead uses parser-owned eye, pitch, yaw, active weapon, fire events, and viewmodel fields, but does not claim exact CS2 client bob, sway, reload state, recoil, spread, crosshair, skins, stickers, or StatTrak.'
}

$manifestPath = Join-Path $outputDir 'manifest.json'
$manifestJson = $manifest | ConvertTo-Json -Depth 8
[System.IO.File]::WriteAllText($manifestPath, $manifestJson, [System.Text.UTF8Encoding]::new($false))

Write-Host "Exported CS2 first-person viewmodel assets to $outputDir"
Write-Host "3D POV viewmodel manifest: $manifestPath"
