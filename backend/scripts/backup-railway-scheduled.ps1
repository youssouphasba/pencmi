# Daily backup for Windows Task Scheduler: runs backup-railway-postgres.ps1, keeps the
# most recent archives and writes one line per run to backups\backup.log.
param(
  [Parameter(Mandatory = $true)][string]$ProjectId,
  [Parameter(Mandatory = $true)][string]$EnvironmentId,
  [Parameter(Mandatory = $true)][string]$ServiceId,
  [Parameter(Mandatory = $true)][string]$RailwayExecutable,
  [ValidateRange(1, 365)][int]$Keep = 14
)

$ErrorActionPreference = 'Stop'
$directory = Join-Path $env:LOCALAPPDATA 'Pencmi\backups'
[System.IO.Directory]::CreateDirectory($directory) | Out-Null
$log = Join-Path $directory 'backup.log'
$stamp = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')
try {
  $result = & (Join-Path $PSScriptRoot 'backup-railway-postgres.ps1') -ProjectId $ProjectId -EnvironmentId $EnvironmentId -ServiceId $ServiceId -RailwayExecutable $RailwayExecutable | ConvertFrom-Json
  $old = Get-ChildItem -LiteralPath $directory -Filter 'pencmi-*.dump.dpapi' | Sort-Object Name -Descending | Select-Object -Skip $Keep
  $old | Remove-Item -Force
  Add-Content -LiteralPath $log -Value "$stamp OK $($result.plaintextBytes) octets sha256=$($result.sha256) supprimees=$(@($old).Count)"
} catch {
  Add-Content -LiteralPath $log -Value "$stamp ECHEC $($_.Exception.Message)"
  exit 1
}
