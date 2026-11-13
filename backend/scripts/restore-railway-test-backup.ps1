param(
  [Parameter(Mandatory = $true)][string]$ProjectId,
  [Parameter(Mandatory = $true)][string]$EnvironmentId,
  [Parameter(Mandatory = $true)][string]$ServiceId,
  [Parameter(Mandatory = $true)][string]$ProductionEnvironmentId,
  [Parameter(Mandatory = $true)][string]$ProductionServiceId,
  [Parameter(Mandatory = $true)][string]$DatabaseName,
  [Parameter(Mandatory = $true)][string]$ArchivePath,
  [Parameter(Mandatory = $true)][string]$ExpectedSha256,
  [Parameter(Mandatory = $true)][string]$RailwayExecutable
)

$ErrorActionPreference = 'Stop'
# Works on Windows PowerShell 5.1 as well as PowerShell 7.
Add-Type -AssemblyName System.Security
function Get-Sha256Hex([byte[]]$bytes) {
  $sha = [Security.Cryptography.SHA256]::Create()
  try { return ([BitConverter]::ToString($sha.ComputeHash($bytes)) -replace '-', '') } finally { $sha.Dispose() }
}
if ($EnvironmentId -eq $ProductionEnvironmentId -or $ServiceId -eq $ProductionServiceId) {
  throw 'La restauration en production est interdite par cet outil.'
}
foreach ($id in @($ProjectId, $EnvironmentId, $ServiceId, $ProductionEnvironmentId, $ProductionServiceId)) {
  if ($id -notmatch '^[0-9a-fA-F-]{36}$') { throw 'Identifiant Railway invalide.' }
}
if ($DatabaseName -notmatch '^[a-z][a-z0-9_]*_test$' -or $DatabaseName.Length -gt 63) {
  throw 'Un nouveau nom de base isolée se terminant par _test est obligatoire.'
}
if ($ExpectedSha256 -notmatch '^[a-fA-F0-9]{64}$') { throw 'Empreinte de sauvegarde invalide.' }
if (!(($env:TEST_DATABASE_URL) -and ([uri]$env:TEST_DATABASE_URL).AbsolutePath -eq ('/' + $DatabaseName))) {
  throw 'La connexion de recette doit viser exactement la nouvelle base.'
}
if ($env:PRODUCTION_CLUSTER_ID -notmatch '^\d+$') { throw 'Identité du cluster de production obligatoire.' }

$archive = $null
try {
  $archive = [Security.Cryptography.ProtectedData]::Unprotect(
    [IO.File]::ReadAllBytes($ArchivePath), $null, [Security.Cryptography.DataProtectionScope]::CurrentUser
  )
  $hash = (Get-Sha256Hex $archive)
  if ($hash -ne $ExpectedSha256) { throw 'Empreinte de sauvegarde incorrecte.' }
  $encoded = [Convert]::ToBase64String($archive)
  node (Join-Path $PSScriptRoot 'test-backup-transport.cjs') --probe-server
  if ($LASTEXITCODE -ne 0) { throw 'Le serveur cible ne peut pas être confirmé comme distinct de la production.' }
  & $RailwayExecutable ssh --project $ProjectId --environment $EnvironmentId --service $ServiceId -- createdb $DatabaseName
  if ($LASTEXITCODE -ne 0) { throw 'Création refusée : utiliser une base nouvelle et vide, sans écrasement.' }

  $env:BACKUP_SHA256 = $hash
  $encoded | node (Join-Path $PSScriptRoot 'test-backup-transport.cjs')
  if ($LASTEXITCODE -ne 0) { throw 'Transport de sauvegarde refusé.' }
  # railway ssh runs the joined arguments through a remote shell, and Windows PowerShell
  # drops embedded double quotes: send the script base64-encoded, with no quote to keep.
  $script = 'set -o pipefail; psql --no-psqlrc --tuples-only --no-align --dbname=' + $DatabaseName + ' --command="SELECT encode(payload, ''base64'') FROM pencmi_backup_transport.archive" | base64 --decode | pg_restore --clean --if-exists --no-owner --no-acl --exit-on-error --dbname=' + $DatabaseName + ' && echo RESTORE_OK'
  $packed = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($script))
  $output = & $RailwayExecutable ssh --project $ProjectId --environment $EnvironmentId --service $ServiceId -- echo $packed '|' base64 -d '|' bash
  if ($LASTEXITCODE -ne 0 -or !(($output -join "`n").Contains('RESTORE_OK'))) {
    throw 'Restauration non confirmée ; inspecter la base isolée, sans toucher à la production.'
  }
  node (Join-Path $PSScriptRoot 'test-backup-transport.cjs') --cleanup
  if ($LASTEXITCODE -ne 0) { throw 'Restauration effectuée ; nettoyage du transport non confirmé.' }
  [pscustomobject]@{ restored = $true; database = $DatabaseName; sha256 = $hash; productionModified = $false } | ConvertTo-Json
} finally {
  if ($archive) { [Array]::Clear($archive, 0, $archive.Length) }
  $encoded = $null
}
