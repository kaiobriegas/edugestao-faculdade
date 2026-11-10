$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$projectDir = Split-Path -Parent $PSScriptRoot
$toolsDir = Join-Path $projectDir '.local\pg-tools'
New-Item -ItemType Directory -Path $toolsDir -Force | Out-Null
if ((Test-Path -LiteralPath (Join-Path $toolsDir 'pg_dump.exe')) -and (Test-Path -LiteralPath (Join-Path $toolsDir 'pg_restore.exe'))) {
  Write-Output 'Ferramentas de transferencia ja preparadas.'
  exit 0
}
$url = 'https://get.enterprisedb.com/postgresql/postgresql-18.6-5-windows-x64-binaries.zip'
$archive = Join-Path $projectDir '.local\pg-transfer-tools.zip'
$checksumText = (Invoke-WebRequest -UseBasicParsing -Uri ($url + '.sha256')).Content
if ($checksumText -is [byte[]]) { $checksumText = [Text.Encoding]::UTF8.GetString($checksumText) }
$expected = ([regex]::Match([string]$checksumText, '(?i)\b[0-9a-f]{64}\b')).Value
if (-not $expected) { throw 'Checksum oficial indisponivel.' }
Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $archive
if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $expected) { throw 'Checksum divergente.' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::OpenRead($archive)
try {
  foreach ($entry in $zip.Entries) {
    if ($entry.FullName -match '^pgsql/bin/([^/]+\.dll|pg_dump\.exe|pg_restore\.exe)$') {
      [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, (Join-Path $toolsDir $entry.Name), $true)
    }
  }
} finally { $zip.Dispose() }
if (-not (Test-Path -LiteralPath (Join-Path $toolsDir 'pg_dump.exe'))) { throw 'pg_dump nao encontrado.' }
Write-Output 'pg_dump/pg_restore preparados em .local/pg-tools, com checksum oficial conferido.'
