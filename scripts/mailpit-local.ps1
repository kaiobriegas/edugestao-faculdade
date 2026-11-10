param([ValidateSet('start','stop','status')][string]$Action = 'start')
$ErrorActionPreference = 'Stop'
$projectDir = Split-Path -Parent $PSScriptRoot
$mailDir = Join-Path $projectDir '.local\mailpit'
$exe = Join-Path $mailDir 'mailpit.exe'
$pidFile = Join-Path $mailDir 'pid'
$running = $null
if (Test-Path -LiteralPath $pidFile) {
  $savedPid = [int](Get-Content -LiteralPath $pidFile)
  $candidate = Get-Process -Id $savedPid -ErrorAction SilentlyContinue
  if ($candidate -and $candidate.Path -eq $exe) { $running = $candidate }
}
if ($Action -eq 'stop') {
  if ($running) { Stop-Process -Id $running.Id }
  Write-Output 'Mailpit local parado; mensagens preservadas.'
} elseif ($Action -eq 'status') {
  if ($running) { Write-Output 'Mailpit local em execução.' } else { Write-Output 'Mailpit local parado.' }
} else {
  if (-not (Test-Path -LiteralPath $exe)) { throw 'Execute scripts/setup-native.ps1 ou use Docker Compose.' }
  if ($running) { Write-Output 'Mailpit local já está em execução.'; exit 0 }
  $proc = Start-Process -FilePath $exe -ArgumentList @('--listen','127.0.0.1:8025','--smtp','127.0.0.1:1025','--database',(Join-Path $mailDir 'mailpit.db')) -WorkingDirectory $projectDir -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $mailDir 'stdout.log') -RedirectStandardError (Join-Path $mailDir 'stderr.log')
  $proc.Id | Set-Content -LiteralPath $pidFile -Encoding ascii
  Write-Output 'Mailpit local iniciado: HTTP 8025 e SMTP 1025, somente loopback.'
}
