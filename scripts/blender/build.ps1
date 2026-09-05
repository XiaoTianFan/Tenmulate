param([ValidateSet('hard-open-arena', 'clay-sunset-arena')][string]$Venue = 'hard-open-arena')
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
Set-Location $root
$env:BLENDER_USER_CONFIG = Join-Path $root '.tools/blender-profile'
node scripts/blender/fetch_materials.mjs
if ($LASTEXITCODE) { throw 'Material preparation failed.' }
$builder = if ($Venue -eq 'clay-sunset-arena') { 'scripts/blender/build_clay_open_arena.py' } else { 'scripts/blender/build_hard_open_arena.py' }
& .tools/blender-5.2.1-windows-x64/blender.exe --background --factory-startup --python-exit-code 1 --python $builder
if ($LASTEXITCODE) { throw 'Blender export failed.' }
node scripts/blender/optimize_venue.mjs $Venue
if ($LASTEXITCODE) { throw 'Venue validation/optimization failed.' }
