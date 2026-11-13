param(
  [Parameter(Mandatory = $true)][string]$ProjectId,
  [Parameter(Mandatory = $true)][string]$EnvironmentId,
  [Parameter(Mandatory = $true)][string]$ServiceId,
  [Parameter(Mandatory = $true)][string]$RailwayExecutable
)

$ErrorActionPreference = 'Stop'
# Works on Windows PowerShell 5.1 as well as PowerShell 7.
Add-Type -AssemblyName System.Security
function Get-Sha256Hex([byte[]]$bytes) {
  $sha = [Security.Cryptography.SHA256]::Create()
  try { return ([BitConverter]::ToString($sha.ComputeHash($bytes)) -replace '-', '') } finally { $sha.Dispose() }
}
foreach ($id in @($ProjectId, $EnvironmentId, $ServiceId)) {
  if ($id -notmatch '^[0-9a-fA-F-]{36}$') { throw 'Identifiant Railway invalide.' }
}
if (!(Test-Path -LiteralPath $RailwayExecutable -PathType Leaf)) {
  throw 'Exécutable Railway introuvable.'
}

$archive = $null
$encrypted = $null
try {
  # railway ssh drops the quotes of a shell command line: run plain commands only.
  $target = @('ssh', '--project', $ProjectId, '--environment', $EnvironmentId, '--service', $ServiceId, '--')
  $remoteFile = '/tmp/pencmi-backup-' + [Guid]::NewGuid().ToString('N') + '.dump'
  try {
    & $RailwayExecutable @target pg_dump --format=custom --no-owner "--file=$remoteFile" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Export PostgreSQL refusé ou interrompu.' }
    $encoded = & $RailwayExecutable @target base64 -w 0 $remoteFile
    if ($LASTEXITCODE -ne 0) { throw 'Lecture de l''export PostgreSQL interrompue.' }
  } finally {
    & $RailwayExecutable @target rm -f $remoteFile | Out-Null
  }
  $archive = [Convert]::FromBase64String(($encoded -join '').Trim())
  if ($archive.Length -lt 5 -or [Text.Encoding]::ASCII.GetString($archive, 0, 5) -ne 'PGDMP') {
    throw 'Archive PostgreSQL invalide.'
  }
  $directory = Join-Path $env:LOCALAPPDATA 'Pencmi\backups'
  [System.IO.Directory]::CreateDirectory($directory) | Out-Null
  $encrypted = [Security.Cryptography.ProtectedData]::Protect(
    $archive, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser
  )
  $file = Join-Path $directory ('pencmi-' + [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss') + '.dump.dpapi')
  if (Test-Path -LiteralPath $file) { throw 'Le fichier de sauvegarde existe déjà.' }
  $stream = [System.IO.File]::Open($file, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
  try { $stream.Write($encrypted, 0, $encrypted.Length) } finally { $stream.Dispose() }
  $recovered = [Security.Cryptography.ProtectedData]::Unprotect(
    [System.IO.File]::ReadAllBytes($file), $null, [Security.Cryptography.DataProtectionScope]::CurrentUser
  )
  try {
    $hash = (Get-Sha256Hex $archive)
    if ((Get-Sha256Hex $recovered) -ne $hash) {
      throw 'Échec de vérification de la sauvegarde chiffrée.'
    }
  } finally {
    if ($recovered) { [Array]::Clear($recovered, 0, $recovered.Length) }
  }
  [pscustomobject]@{
    path = $file
    format = 'PostgreSQL custom archive encrypted with Windows DPAPI CurrentUser'
    plaintextBytes = $archive.Length
    sha256 = $hash
    encryptedReadbackVerified = $true
    restored = $false
  } | ConvertTo-Json
} finally {
  if ($archive) { [Array]::Clear($archive, 0, $archive.Length) }
  $encoded = $null
  $encrypted = $null
}
