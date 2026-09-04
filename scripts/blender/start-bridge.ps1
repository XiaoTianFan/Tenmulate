param([switch]$Gui, [string]$BlendFile)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$env:BLENDER_USER_CONFIG = Join-Path $root '.tools/blender-profile'
$blender = Join-Path $root '.tools/blender-5.2.1-windows-x64/blender.exe'
$arguments = @('--factory-startup', '--online-mode')
if (!$Gui) { $arguments += '--background' }
if ($BlendFile) { $arguments += (Resolve-Path $BlendFile).Path }
$arguments += @('--python', (Join-Path $PSScriptRoot 'bootstrap_bridge.py'))
if (!$Gui) { $arguments += @('--command', 'blender_mcp', '--host', '127.0.0.1', '--port', '9876') }
& $blender @arguments
