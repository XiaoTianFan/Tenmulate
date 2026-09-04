param([switch]$SkipDownload)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
Set-Location $root
$version = '5.2.1'
$mcpRevision = '4309a39646e644261624bfcd2bca669b343b7621'
New-Item -ItemType Directory -Force '.tools/downloads', '.tools/blender-profile' | Out-Null
$blender = Join-Path $root ".tools/blender-$version-windows-x64/blender.exe"
if (!(Test-Path $blender)) {
    if ($SkipDownload) { throw 'Portable Blender has not been installed.' }
    $zip = ".tools/downloads/blender-$version-windows-x64.zip"
    $hashes = ".tools/downloads/blender-$version.sha256"
    & curl.exe -L --fail --silent --show-error "https://download.blender.org/release/Blender5.2/blender-$version-windows-x64.zip" -o $zip
    if ($LASTEXITCODE) { throw 'Blender download failed.' }
    & curl.exe -L --fail --silent --show-error "https://download.blender.org/release/Blender5.2/blender-$version.sha256" -o $hashes
    if ($LASTEXITCODE) { throw 'Checksum download failed.' }
    $expected = ((Get-Content $hashes | Select-String 'windows-x64.zip').Line -split '\s+')[0]
    if ((Get-FileHash $zip -Algorithm SHA256).Hash -ne $expected) { throw 'Blender checksum mismatch.' }
    Expand-Archive -LiteralPath $zip -DestinationPath '.tools'
}
if (!(Test-Path '.tools/blender-mcp/.git')) {
    git clone https://projects.blender.org/lab/blender_mcp.git .tools/blender-mcp
    if ($LASTEXITCODE) { throw 'MCP clone failed.' }
}
git -C .tools/blender-mcp checkout --detach $mcpRevision
if ($LASTEXITCODE) { throw 'MCP revision unavailable.' }
if (!(Test-Path '.tools/mcp-venv/Scripts/python.exe')) { python -m venv .tools/mcp-venv }
& .tools/mcp-venv/Scripts/python.exe -m pip install 'mcp[cli]==1.29.1' ./.tools/blender-mcp/mcp
if ($LASTEXITCODE) { throw 'MCP installation failed.' }
& $blender --background --factory-startup --version
Write-Output 'Ready. Start the project bridge with scripts/blender/start-bridge.ps1.'
