$ErrorActionPreference = 'Stop'
$playerRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$playerSpec = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'source.json') -Raw | ConvertFrom-Json
$playerCache = Join-Path $playerRoot 'artifacts/character-source'
New-Item -ItemType Directory -Force -Path $playerCache | Out-Null
$playerArchive = Join-Path $playerCache 'quaternius-mannequin-standard.zip'
if (-not (Test-Path -LiteralPath $playerArchive)) {
  $playerDownload = Invoke-RestMethod -Method Post -Headers @{'X-Requested-With'='XMLHttpRequest'} -Uri $playerSpec.downloadEndpoint
  if (-not $playerDownload.url) { throw 'Creator did not return a free download URL.' }
  Invoke-WebRequest -Uri $playerDownload.url -OutFile $playerArchive
}
if ((Get-FileHash -LiteralPath $playerArchive).Hash.ToLowerInvariant() -ne $playerSpec.archiveSha256) { throw 'Mannequin archive checksum mismatch.' }
Expand-Archive -LiteralPath $playerArchive -DestinationPath (Join-Path $playerCache 'quaternius-mannequin-standard') -Force
Write-Output 'Verified CC0 mannequin source is ready.'
