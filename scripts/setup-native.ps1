# Alternativa opcional para desenvolvimento Windows sem Docker.
$ErrorActionPreference = 'Stop'
$projectDir = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $projectDir
try {
  $env:NODE_USE_SYSTEM_CA = '1'
  New-Item -ItemType Directory -Path '.local\pg-runtime' -Force | Out-Null
  & npm.cmd install --prefix .local/pg-runtime --save-exact --ignore-scripts --no-fund --no-audit '@embedded-postgres/windows-x64@18.4.0-beta.17'
  if ($LASTEXITCODE -ne 0) { throw 'Falha ao obter os binários nativos do PostgreSQL.' }
  $mailDir = Join-Path $projectDir '.local\mailpit'
  New-Item -ItemType Directory -Path $mailDir -Force | Out-Null
  $archive = Join-Path $mailDir 'mailpit.zip'
  Invoke-WebRequest -Uri 'https://github.com/axllent/mailpit/releases/download/v1.32.0/mailpit-windows-amd64.zip' -OutFile $archive
  $expected = '16915767a6c95dca569336e8f561f91cf355e9a33c57b91deedcc10a4bba7fd4'
  if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLower() -ne $expected) { throw 'Checksum Mailpit inválido.' }
  Expand-Archive -LiteralPath $archive -DestinationPath $mailDir -Force
  Write-Output 'Binários preparados em .local; nenhuma instalação global ou serviço Windows criado.'
} finally { Pop-Location }
